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

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    include: { companyUsers: { include: { user: true } } },
  });

  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(company);
}

export async function PUT(
  req: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canEdit =
    session.user.role === "SUPER_ADMIN" ||
    (await isCompanyAdmin(session.user.id, params.companyId));

  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();

  const company = await prisma.company.update({
    where: { id: params.companyId },
    data: { name, description },
  });

  return NextResponse.json(company);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const canDelete =
    session.user.role === "SUPER_ADMIN" ||
    (await isCompanyAdmin(session.user.id, params.companyId));

  if (!canDelete) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.company.delete({ where: { id: params.companyId } });

  return NextResponse.json({ success: true });
}
