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

  const transactions = await prisma.transaction.findMany({
    where: { companyId },
    include: { addedBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  let totalIncome = 0, totalExpense = 0, totalLoanGiven = 0, totalLoanReceived = 0;

  // Group by month
  const monthlyMap: Record<string, { income: number; expense: number; loanGiven: number; loanReceived: number }> = {};

  for (const tx of transactions) {
    const key = `${tx.date.getFullYear()}-${String(tx.date.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0, loanGiven: 0, loanReceived: 0 };

    if (tx.type === "INCOME") { totalIncome += tx.amount; monthlyMap[key].income += tx.amount; }
    else if (tx.type === "EXPENSE") { totalExpense += tx.amount; monthlyMap[key].expense += tx.amount; }
    else if (tx.type === "LOAN_GIVEN") { totalLoanGiven += tx.amount; monthlyMap[key].loanGiven += tx.amount; }
    else if (tx.type === "LOAN_RECEIVED") { totalLoanReceived += tx.amount; monthlyMap[key].loanReceived += tx.amount; }
  }

  const monthlyBreakdown = Object.entries(monthlyMap).map(([key, data]) => ({
    period: key,
    ...data,
    net: data.income - data.expense,
  }));

  return NextResponse.json({
    summary: { totalIncome, totalExpense, totalLoanGiven, totalLoanReceived, net: totalIncome - totalExpense },
    monthlyBreakdown,
    totalTransactions: transactions.length,
  });
}
