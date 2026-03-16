import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getBalanceDelta } from "@/lib/constants";

export async function POST(
  req: Request,
  { params }: { params: { companyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only SUPER_ADMIN or company ADMIN can adjust
  const cu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: params.companyId, userId: session.user.id } },
    select: { role: true },
  });
  const canEdit = session.user.role === "SUPER_ADMIN" || cu?.role === "ADMIN";
  if (!canEdit) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { partnerId, field, currentValue, newValue } = await req.json();
  if (!partnerId || !field || newValue === undefined || currentValue === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const diff = newValue - currentValue;
  if (diff === 0) return NextResponse.json({ message: "No change" });

  // Verify partner belongs to this company
  const partnerCu = await prisma.companyUser.findUnique({
    where: { companyId_userId: { companyId: params.companyId, userId: partnerId } },
  });
  if (!partnerCu) return NextResponse.json({ error: "Partner not in company" }, { status: 400 });

  // Determine transaction type and amount
  let type: string;
  let amount: number;
  let loanDirection: string | null = null;

  if (field === "total") {
    // Adjusting total income
    if (diff > 0) {
      type = "INCOME";
      amount = diff;
    } else {
      type = "EXPENSE";
      amount = Math.abs(diff);
    }
  } else {
    // Adjusting loan
    if (diff > 0) {
      type = "LOAN_GIVEN";
      amount = diff;
    } else {
      type = "LOAN_REPAYMENT";
      loanDirection = "INFLOW";
      amount = Math.abs(diff);
    }
  }

  // Get last running balance
  const lastTx = await prisma.transaction.findFirst({
    where: { companyId: params.companyId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { runningBalance: true },
  });

  const prevBalance = lastTx?.runningBalance ?? 0;
  const delta = getBalanceDelta(type, loanDirection);
  const runningBalance = prevBalance + delta * amount;

  await prisma.transaction.create({
    data: {
      companyId: params.companyId,
      addedById: partnerId,
      type,
      category: null,
      loanDirection,
      amount,
      description: "Manual adjustment",
      date: new Date(),
      runningBalance,
    },
  });

  return NextResponse.json({ success: true });
}
