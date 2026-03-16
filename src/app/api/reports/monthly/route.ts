import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get("companyId");
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));

  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: { companyId, date: { gte: start, lte: end } },
    include: { addedBy: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  let totalIncome = 0, totalExpense = 0, totalLoanGiven = 0, totalLoanReceived = 0;

  for (const tx of transactions) {
    if (tx.type === "INCOME") totalIncome += tx.amount;
    else if (tx.type === "EXPENSE") totalExpense += tx.amount;
    else if (tx.type === "LOAN_GIVEN") totalLoanGiven += tx.amount;
    else if (tx.type === "LOAN_RECEIVED") totalLoanReceived += tx.amount;
  }

  return NextResponse.json({
    transactions,
    summary: { totalIncome, totalExpense, totalLoanGiven, totalLoanReceived, net: totalIncome - totalExpense },
    period: { year, month },
  });
}
