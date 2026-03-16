import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalanceDelta } from "@/lib/constants";

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

  // Outstanding loans
  const loanTxs = await prisma.transaction.findMany({
    where: {
      companyId,
      type: { in: ["LOAN_GIVEN", "LOAN_RECEIVED", "LOAN_REPAYMENT"] },
    },
    include: { addedBy: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  // Compute net outstanding loan balance
  let outstandingLoans = 0;
  for (const tx of loanTxs) {
    const delta = getBalanceDelta(tx.type, tx.loanDirection);
    // Loans affect balance differently: LOAN_GIVEN = money out (we're owed), LOAN_RECEIVED = money in (we owe)
    if (tx.type === "LOAN_GIVEN") outstandingLoans += tx.amount;
    else if (tx.type === "LOAN_RECEIVED") outstandingLoans -= tx.amount;
    else if (tx.type === "LOAN_REPAYMENT") {
      outstandingLoans += delta * tx.amount;
    }
  }

  // Recent transactions
  const recentTransactions = await prisma.transaction.findMany({
    where: { companyId },
    include: { addedBy: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  return NextResponse.json({
    currentBalance,
    monthlyIncome,
    monthlyExpense,
    outstandingLoans,
    chartData,
    recentTransactions,
  });
}
