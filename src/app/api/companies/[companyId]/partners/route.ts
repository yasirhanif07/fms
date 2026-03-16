import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function isCompanyAdmin(userId: string, companyId: string) {
  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId } },
    select: { role: true },
  });
  return cu?.role === "ADMIN";
}

export async function GET(
  _req: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partners = await prisma.companyUser.findMany({
    where: { companyId: params.companyId },
    include: { user: true },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json(partners);
}

export async function POST(
  req: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canManage =
    session.user.role === "SUPER_ADMIN" ||
    (await isCompanyAdmin(session.user.id, params.companyId));

  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, role } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const existing = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: params.companyId, userId } },
  });
  if (existing) return NextResponse.json({ error: "User already in company" }, { status: 400 });

  const companyUser = await prisma.companyUser.create({
    data: { companyId: params.companyId, userId, role: role || "PARTNER" },
    include: { user: true },
  });

  return NextResponse.json(companyUser, { status: 201 });
}
