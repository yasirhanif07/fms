import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { companyId: string; userId: string };

async function isCompanyAdmin(sessionUserId: string, companyId: string) {
  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId, userId: sessionUserId } },
    select: { role: true },
  });
  return cu?.role === "ADMIN";
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, userId } = await params;

  const canManage =
    session.user.role === "SUPER_ADMIN" ||
    (await isCompanyAdmin(session.user.id, companyId));

  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.companyUser.delete({
    where: { companyId_userId: { companyId, userId } },
  });

  return NextResponse.json({ success: true });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<Params> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { companyId, userId } = await params;

  const canManage =
    session.user.role === "SUPER_ADMIN" ||
    (await isCompanyAdmin(session.user.id, companyId));

  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { role } = await req.json();

  const updated = await prisma.companyUser.update({
    where: { companyId_userId: { companyId, userId } },
    data: { role },
    include: { user: true },
  });

  return NextResponse.json(updated);
}
