import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { companyId: string; partnerId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.companyUser.delete({ where: { id: params.partnerId } });

  return NextResponse.json({ success: true });
}

export async function PUT(
  req: Request,
  { params }: { params: { companyId: string; partnerId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { role } = await req.json();

  const updated = await prisma.companyUser.update({
    where: { id: params.partnerId },
    data: { role },
    include: { user: true },
  });

  return NextResponse.json(updated);
}
