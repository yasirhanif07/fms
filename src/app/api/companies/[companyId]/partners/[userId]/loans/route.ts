import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { companyId: string; userId: string };

export async function GET(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, userId } = await params;

  const loans = await prisma.partnerLoan.findMany({
    where: { companyId, userId },
    orderBy: { date: "desc" },
    select: { id: true, amount: true, description: true, date: true },
  });

  return NextResponse.json(loans);
}

export async function POST(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, userId } = await params;

  // Auth check: SUPER_ADMIN or company ADMIN
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const cu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId: session.user.id } },
      select: { role: true },
    });
    if (!cu || cu.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { amount, description, date } = await req.json();

  if (!amount || typeof amount !== "number") {
    return NextResponse.json({ error: "amount is required" }, { status: 400 });
  }

  const loan = await prisma.partnerLoan.create({
    data: {
      companyId,
      userId,
      amount,
      description: description || null,
      date: date ? new Date(date) : new Date(),
    },
    select: { id: true, amount: true, description: true, date: true },
  });

  return NextResponse.json(loan, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, userId } = await params;

  // Auth check: SUPER_ADMIN or company ADMIN
  const isSuperAdmin = session.user.role === "SUPER_ADMIN";
  if (!isSuperAdmin) {
    const cu = await prisma.companyUser.findUnique({
      where: { companyId_userId: { companyId, userId: session.user.id } },
      select: { role: true },
    });
    if (!cu || cu.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const loanId = searchParams.get("loanId");
  if (!loanId) return NextResponse.json({ error: "loanId required" }, { status: 400 });

  await prisma.partnerLoan.delete({ where: { id: loanId } });

  return NextResponse.json({ ok: true });
}
