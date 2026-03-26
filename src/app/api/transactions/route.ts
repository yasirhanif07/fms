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
  const type = searchParams.get("type");
  const category = searchParams.get("category");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!companyId) return NextResponse.json({ error: "companyId required" }, { status: 400 });

  const where: Record<string, unknown> = { companyId };
  if (type) where.type = type;
  if (category) where.category = category;
  if (from || to) {
    where.date = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    };
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { addedBy: { select: { id: true, name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({ transactions, total, page, limit });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { companyId, type, category, loanDirection, amount, description, date, addedById } = body;

  if (!companyId || !type || !amount || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate addedById belongs to this company, fall back to session user
  let resolvedAddedById = session.user.id;
  if (addedById) {
    const cu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId: addedById } },
    });
    if (cu) resolvedAddedById = addedById;
  }

  // Get the last running balance for this company
  const lastTx = await prisma.transaction.findFirst({
    where: { companyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { runningBalance: true },
  });

  const prevBalance = lastTx?.runningBalance ?? 0;
  const delta = getBalanceDelta(type, loanDirection);
  const runningBalance = prevBalance + delta * Math.abs(amount);

  const transaction = await prisma.transaction.create({
    data: {
      companyId,
      addedById: resolvedAddedById,
      type,
      category: category || null,
      loanDirection: loanDirection || null,
      amount: Math.abs(amount),
      description: description || null,
      date: new Date(date),
      runningBalance,
    },
    include: { addedBy: { select: { id: true, name: true } } },
  });

  return NextResponse.json(transaction, { status: 201 });
}

// DELETE: bulk delete by IDs or all for a company
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids, companyId }: { ids?: string[]; companyId?: string } = await req.json();

  if (companyId) {
    // Delete ALL transactions for a company
    const cu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId: session.user.id } },
      select: { role: true },
    });
    const canDelete = session.user.role === "SUPER_ADMIN" || cu?.role === "ADMIN";
    if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { count } = await prisma.transaction.deleteMany({ where: { companyId } });
    return NextResponse.json({ deleted: count });
  }

  if (ids?.length) {
    // Verify user has access to these transactions
    const txs = await prisma.transaction.findMany({
      where: { id: { in: ids } },
      select: { companyId: true },
    });
    const companyIds = Array.from(new Set(txs.map((t) => t.companyId)));
    for (const cid of companyIds) {
      const cu = await prisma.companyUser.findUnique({
        where: { companyId_userId: { companyId: cid, userId: session.user.id } },
        select: { role: true },
      });
      const canDelete = session.user.role === "SUPER_ADMIN" || cu?.role === "ADMIN";
      if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { count } = await prisma.transaction.deleteMany({ where: { id: { in: Array.from(ids) } } });
    return NextResponse.json({ deleted: count });
  }

  return NextResponse.json({ error: "ids or companyId required" }, { status: 400 });
}
