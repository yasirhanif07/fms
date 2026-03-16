import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const companies =
    session.user.role === "SUPER_ADMIN"
      ? await prisma.company.findMany({
          include: { companyUsers: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
        })
      : await prisma.company.findMany({
          where: { companyUsers: { some: { userId: session.user.id } } },
          include: { companyUsers: { include: { user: true } } },
          orderBy: { createdAt: "desc" },
        });

  return NextResponse.json(companies);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user.role === "VIEWER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const company = await prisma.company.create({
    data: {
      name,
      description,
      companyUsers: {
        create: { userId: session.user.id, role: "ADMIN" },
      },
    },
    include: { companyUsers: { include: { user: true } } },
  });

  return NextResponse.json(company, { status: 201 });
}
