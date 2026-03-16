import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

  const { name, email, role } = await req.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  // Find or create user by email
  let user = await prisma.user.findUnique({ where: { email } });
  const isNewUser = !user;
  if (!user) {
    const passwordHash = await bcrypt.hash("fms@123", 12);
    user = await prisma.user.create({
      data: { name, email, passwordHash, role: "ADMIN" },
    });
  }

  const existing = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: params.companyId, userId: user.id } },
  });
  if (existing) return NextResponse.json({ error: "User already in this company" }, { status: 400 });

  const companyUser = await prisma.companyUser.create({
    data: { companyId: params.companyId, userId: user.id, role: role || "PARTNER" },
    include: { user: true },
  });

  return NextResponse.json({ ...companyUser, isNewUser, tempPassword: isNewUser ? "fms@123" : null }, { status: 201 });
}
