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
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { companyId, transactions }: { companyId: string; transactions: ImportTransaction[] } = await req.json();

  if (!companyId || !transactions?.length) {
    return NextResponse.json({ error: "companyId and transactions required" }, { status: 400 });
  }

  // Get current running balance
  const lastTx = await prisma.transaction.findFirst({
    where: { companyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { runningBalance: true },
  });

  let runningBalance = lastTx?.runningBalance ?? 0;

  // Sort by date ascending before inserting
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Bulk insert using createMany isn't supported with running balance — insert sequentially in a transaction
  const created = await prisma.$transaction(
    sorted.map((tx) => {
      const delta = getBalanceDelta(tx.type, null);
      runningBalance = runningBalance + delta * tx.amount;
      const currentBalance = runningBalance;

      return prisma.transaction.create({
        data: {
          companyId,
          addedById: session.user.id,
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

  return NextResponse.json({ imported: created.length });
}
