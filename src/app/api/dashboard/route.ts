import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  // Current balance (latest transaction)
  const lastTx = await prisma.transaction.findFirst({
    where: { companyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { runningBalance: true },
  });
  const currentBalance = lastTx?.runningBalance ?? 0;

  // Current month income & expense
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const monthlyTxs = await prisma.transaction.findMany({
    where: { companyId, date: { gte: monthStart, lte: monthEnd } },
    select: { type: true, amount: true, loanDirection: true },
  });

  let monthlyIncome = 0;
  let monthlyExpense = 0;
  for (const tx of monthlyTxs) {
    if (tx.type === "INCOME") monthlyIncome += tx.amount;
    if (tx.type === "EXPENSE") monthlyExpense += tx.amount;
  }

  // Last 6 months chart data
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

    const txs = await prisma.transaction.findMany({
      where: { companyId, date: { gte: start, lte: end } },
      select: { type: true, amount: true },
    });

    let income = 0, expense = 0;
    for (const tx of txs) {
      if (tx.type === "INCOME") income += tx.amount;
      if (tx.type === "EXPENSE") expense += tx.amount;
    }

    chartData.push({
      month: d.toLocaleString("default", { month: "short" }),
      year: d.getFullYear(),
      income,
      expense,
    });
  }

  // Recent transactions
  const recentTransactions = await prisma.transaction.findMany({
    where: { companyId },
    include: { addedBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  // Partner holdings breakdown
  const companyUsers = await prisma.companyUser.findMany({
    where: { companyId },
    include: {
      user: {
        include: {
          transactions: {
            where: { companyId, type: { in: ["INCOME", "EXPENSE", "LOAN_REPAYMENT", "LOAN_GIVEN"] } },
            select: { type: true, amount: true, loanDirection: true },
          },
          partnerLoans: {
            where: { companyId },
            select: { id: true, amount: true, description: true, date: true },
          },
        },
      },
    },
  });

  // LOAN_GIVEN → auto-increase recipient's loan
  const loanGivenTxs = await prisma.transaction.findMany({
    where: { companyId, type: "LOAN_GIVEN", loanRecipientId: { not: null } },
    select: { loanRecipientId: true, amount: true },
  });
  const loanReceivedByUser: Record<string, number> = {};
  for (const tx of loanGivenTxs) {
    if (tx.loanRecipientId) {
      loanReceivedByUser[tx.loanRecipientId] = (loanReceivedByUser[tx.loanRecipientId] ?? 0) + tx.amount;
    }
  }

  // LOAN_REPAYMENT INFLOW → auto-decrease repayer's loan, increase their holdings
  const loanRepaymentTxs = await prisma.transaction.findMany({
    where: { companyId, type: "LOAN_REPAYMENT", loanDirection: "INFLOW" },
    select: { loanRecipientId: true, addedById: true, amount: true },
  });
  const loanRepaidByUser: Record<string, number> = {};
  for (const tx of loanRepaymentTxs) {
    const userId = tx.loanRecipientId ?? tx.addedById;
    loanRepaidByUser[userId] = (loanRepaidByUser[userId] ?? 0) + tx.amount;
  }

  const partnerHoldings = companyUsers.map((cu) => {
    const txDelta = cu.user.transactions.reduce((s, t) => {
      if (t.type === "INCOME") return s + t.amount;
      if (t.type === "EXPENSE") return s - t.amount;
      if (t.type === "LOAN_GIVEN") return s - t.amount; // giver's holdings decrease
      if (t.type === "LOAN_REPAYMENT" && t.loanDirection === "OUTFLOW") return s - t.amount; // company repays external
      return s;
    }, 0);
    const loanRepaid = loanRepaidByUser[cu.userId] ?? 0;
    const loanReceived = loanReceivedByUser[cu.userId] ?? 0;
    const loanTxDelta = loanReceived - loanRepaid;
    const holdings = cu.baseHoldings + txDelta + loanRepaid; // repayer's equity increases
    const partnerLoansSum = cu.user.partnerLoans.reduce((s, l) => s + l.amount, 0);
    const loan = cu.baseLoan + partnerLoansSum + loanTxDelta; // auto: +received -repaid
    return {
      id: cu.userId,
      name: cu.user.name,
      role: cu.role,
      baseHoldings: cu.baseHoldings,
      baseLoan: cu.baseLoan,
      holdings,
      loan,
      loanTxDelta,
      loans: cu.user.partnerLoans,
      total: holdings + loan,
    };
  });

  // Outstanding loans = sum of all partner loan values
  const outstandingLoans = partnerHoldings.reduce((s, p) => s + p.loan, 0);

  return NextResponse.json({
    currentBalance,
    monthlyIncome,
    monthlyExpense,
    outstandingLoans,
    chartData,
    recentTransactions,
    partnerHoldings,
  });
}
