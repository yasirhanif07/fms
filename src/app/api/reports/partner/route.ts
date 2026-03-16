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
            where: { companyId, type: "INCOME" },
            select: { type: true, amount: true },
          },
        },
      },
    },
  });

  const partnerReports = companyUsers.map((cu) => {
    const txIncome = cu.user.transactions
      .filter((t) => t.type === "INCOME")
      .reduce((s, t) => s + t.amount, 0);
    const holdings = cu.baseHoldings + txIncome;
    const loan = cu.baseLoan; // loan from base (CSV summary) only
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
