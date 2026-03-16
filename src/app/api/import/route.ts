import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalanceDelta } from "@/lib/constants";

interface ImportTransaction {
  date: string;
  type: string;
  category: string | null;
  amount: number;
  description: string;
  addedById: string; // partner who added this transaction
}

interface PartnerBaseValue {
  userId: string;
  holdings: number;
  loan: number;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const {
    companyId,
    transactions,
    partnerBaseValues,
  }: { companyId: string; transactions: ImportTransaction[]; partnerBaseValues?: PartnerBaseValue[] } = await req.json();

  if (!companyId || !transactions?.length) {
    return NextResponse.json({ error: "companyId and transactions required" }, { status: 400 });
  }

  // Validate all addedById values belong to this company
  const companyUserIds = await prisma.companyUser.findMany({
    where: { companyId },
    select: { userId: true },
  });
  const validUserIds = new Set(companyUserIds.map((cu) => cu.userId));

  // Get current running balance
  const lastTx = await prisma.transaction.findFirst({
    where: { companyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { runningBalance: true },
  });

  let runningBalance = lastTx?.runningBalance ?? 0;

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const created = await prisma.$transaction(
    sorted.map((tx) => {
      const delta = getBalanceDelta(tx.type, null);
      runningBalance = runningBalance + delta * tx.amount;
      const currentBalance = runningBalance;

      // Fall back to the importer's own ID if assigned partner is invalid
      const addedById = validUserIds.has(tx.addedById) ? tx.addedById : session.user.id;

      return prisma.transaction.create({
        data: {
          companyId,
          addedById,
          type: tx.type,
          category: tx.category || null,
          loanDirection: null,
          amount: tx.amount,
          description: tx.description,
          date: new Date(tx.date),
          runningBalance: currentBalance,
        },
      });
    })
  );

  // Handle partnerBaseValues: create PartnerLoan for loan > 0, update baseHoldings
  if (partnerBaseValues && partnerBaseValues.length > 0) {
    const now = new Date();
    for (const entry of partnerBaseValues) {
      if (!validUserIds.has(entry.userId)) continue;

      // Update baseHoldings on CompanyUser
      await prisma.companyUser.update({
        where: { companyId_userId: { companyId, userId: entry.userId } },
        data: { baseHoldings: entry.holdings },
      });

      // Create PartnerLoan for loan > 0
      if (entry.loan > 0) {
        await prisma.partnerLoan.create({
          data: {
            companyId,
            userId: entry.userId,
            amount: entry.loan,
            description: "Opening balance",
            date: now,
          },
        });
      }
    }
  }

  return NextResponse.json({ imported: created.length });
}
