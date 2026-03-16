import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalanceDelta } from "@/lib/constants";

export async function GET(
  _req: Request,
  { params }: { params: { transactionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tx = await prisma.transaction.findUnique({
    where: { id: params.transactionId },
    include: { addedBy: { select: { id: true, name: true } }, company: true },
  });

  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(tx);
}

export async function PUT(
  req: Request,
  { params }: { params: { transactionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only SUPER_ADMIN or company ADMIN can edit
  const tx = await prisma.transaction.findUnique({ where: { id: params.transactionId } });
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: tx.companyId, userId: session.user.id } },
    select: { role: true },
  });
  const canEdit = session.user.role === "SUPER_ADMIN" || cu?.role === "ADMIN";
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { type, category, loanDirection, amount, description, date, addedById } = await req.json();

  // Validate addedById belongs to this company
  let resolvedAddedById = tx.addedById;
  if (addedById) {
    const memberCu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId: tx.companyId, userId: addedById } },
    });
    if (memberCu) resolvedAddedById = addedById;
  }

  // Update the transaction
  await prisma.transaction.update({
    where: { id: params.transactionId },
    data: {
      type,
      category: category || null,
      loanDirection: loanDirection || null,
      amount: Math.abs(parseFloat(amount)),
      description: description || null,
      date: new Date(date),
      addedById: resolvedAddedById,
    },
  });

  // Recalculate running balances for all transactions in this company ordered by date
  const allTxs = await prisma.transaction.findMany({
    where: { companyId: tx.companyId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { id: true, type: true, loanDirection: true, amount: true },
  });

  let runningBalance = 0;
  await prisma.$transaction(
    allTxs.map((t) => {
      const delta = getBalanceDelta(t.type, t.loanDirection);
      runningBalance += delta * t.amount;
      return prisma.transaction.update({
        where: { id: t.id },
        data: { runningBalance },
      });
    })
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { transactionId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.transaction.delete({ where: { id: params.transactionId } });
  return NextResponse.json({ success: true });
}
