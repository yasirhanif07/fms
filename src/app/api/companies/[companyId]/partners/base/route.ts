import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PUT: set baseHoldings + baseLoan for multiple partners at once
export async function PUT(
  req: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: params.companyId, userId: session.user.id } },
    select: { role: true },
  });
  const canEdit = session.user.role === "SUPER_ADMIN" || cu?.role === "ADMIN";
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // rows: [{ userId, baseHoldings, baseLoan }]
  const { rows }: { rows: { userId: string; baseHoldings: number; baseLoan: number }[] } = await req.json();
  if (!rows?.length) return NextResponse.json({ error: "rows required" }, { status: 400 });

  await prisma.$transaction(
    rows.map((r) =>
      prisma.companyUser.update({
        where: { companyId_userId: { companyId: params.companyId, userId: r.userId } },
        data: { baseHoldings: r.baseHoldings, baseLoan: r.baseLoan },
      })
    )
  );

  return NextResponse.json({ success: true });
}
