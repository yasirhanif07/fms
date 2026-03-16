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

  const companyUsers = await prisma.companyUser.findMany({
    where: { companyId },
    include: {
      user: {
        include: {
          transactions: {
            where: { companyId },
            select: { type: true, amount: true, date: true, description: true, category: true },
          },
        },
      },
    },
  });

  const partnerReports = companyUsers.map((cu) => {
    const txs = cu.user.transactions;
    let txIncome = 0, txLoan = 0;
    for (const tx of txs) {
      if (tx.type === "INCOME") txIncome += tx.amount;
      else if (tx.type === "LOAN_GIVEN") txLoan += tx.amount;
    }
    const holdings = cu.baseHoldings + txIncome;
    const loan = cu.baseLoan + txLoan;
    return {
      partnerId: cu.userId,
      partnerName: cu.user.name,
      partnerEmail: cu.user.email,
      role: cu.role,
      income: holdings,
      loanGiven: loan,
    };
  });

  return NextResponse.json(partnerReports);
}
