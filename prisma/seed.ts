import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@fms.com" },
    update: {},
    create: {
      name: "Ali Hassan",
      email: "admin@fms.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  const partner1 = await prisma.user.upsert({
    where: { email: "ahmed@fms.com" },
    update: {},
    create: {
      name: "Ahmed Khan",
      email: "ahmed@fms.com",
      passwordHash: await bcrypt.hash("password123", 12),
      role: "PARTNER",
    },
  });

  const partner2 = await prisma.user.upsert({
    where: { email: "sara@fms.com" },
    update: {},
    create: {
      name: "Sara Malik",
      email: "sara@fms.com",
      passwordHash: await bcrypt.hash("password123", 12),
      role: "PARTNER",
    },
  });

  // Create company
  const company = await prisma.company.upsert({
    where: { id: "seed-company-1" },
    update: {},
    create: {
      id: "seed-company-1",
      name: "Alpha Trading Co.",
      description: "Import & export business",
    },
  });

  // Add users to company
  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: admin.id } },
    update: {},
    create: { companyId: company.id, userId: admin.id, role: "ADMIN" },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: partner1.id } },
    update: {},
    create: { companyId: company.id, userId: partner1.id, role: "PARTNER" },
  });

  await prisma.companyUser.upsert({
    where: { companyId_userId: { companyId: company.id, userId: partner2.id } },
    update: {},
    create: { companyId: company.id, userId: partner2.id, role: "PARTNER" },
  });

  // Create sample transactions across last 6 months
  const now = new Date();
  let runningBalance = 0;

  const sampleTxs = [
    { type: "INCOME", amount: 500000, description: "Sales revenue — Q4", addedById: admin.id, monthsAgo: 5 },
    { type: "EXPENSE", category: "SALARIES", amount: 150000, description: "Staff salaries", addedById: partner1.id, monthsAgo: 5 },
    { type: "EXPENSE", category: "UTILITIES", amount: 25000, description: "Electricity & internet", addedById: admin.id, monthsAgo: 5 },
    { type: "LOAN_GIVEN", amount: 100000, description: "Loan to Raza Brothers", addedById: admin.id, monthsAgo: 4 },
    { type: "INCOME", amount: 350000, description: "Export payment received", addedById: partner2.id, monthsAgo: 4 },
    { type: "EXPENSE", category: "OFFICE_SUPPLIES", amount: 18000, description: "Office stationery & supplies", addedById: partner1.id, monthsAgo: 4 },
    { type: "LOAN_RECEIVED", amount: 200000, description: "Loan from Kareem Finance", addedById: admin.id, monthsAgo: 3 },
    { type: "INCOME", amount: 420000, description: "Product sales — January", addedById: admin.id, monthsAgo: 3 },
    { type: "EXPENSE", category: "SALARIES", amount: 150000, description: "Staff salaries", addedById: partner1.id, monthsAgo: 3 },
    { type: "EXPENSE", category: "UTILITIES", amount: 22000, description: "Utilities bill", addedById: admin.id, monthsAgo: 3 },
    { type: "LOAN_REPAYMENT", loanDirection: "INFLOW", amount: 50000, description: "Partial repayment from Raza Brothers", addedById: admin.id, monthsAgo: 2 },
    { type: "INCOME", amount: 600000, description: "Wholesale order payment", addedById: partner2.id, monthsAgo: 2 },
    { type: "EXPENSE", category: "SALARIES", amount: 150000, description: "Staff salaries", addedById: partner1.id, monthsAgo: 2 },
    { type: "EXPENSE", category: "OFFICE_SUPPLIES", amount: 35000, description: "New equipment", addedById: admin.id, monthsAgo: 2 },
    { type: "INCOME", amount: 280000, description: "Service charges collected", addedById: admin.id, monthsAgo: 1 },
    { type: "EXPENSE", category: "SALARIES", amount: 150000, description: "Staff salaries", addedById: partner1.id, monthsAgo: 1 },
    { type: "EXPENSE", category: "UTILITIES", amount: 30000, description: "Utilities & rent", addedById: admin.id, monthsAgo: 1 },
    { type: "INCOME", amount: 450000, description: "Export revenue", addedById: partner2.id, monthsAgo: 0 },
    { type: "EXPENSE", category: "SALARIES", amount: 150000, description: "Staff salaries", addedById: partner1.id, monthsAgo: 0 },
    { type: "EXPENSE", category: "OFFICE_SUPPLIES", amount: 12000, description: "Office supplies", addedById: admin.id, monthsAgo: 0 },
  ];

  // Clear existing transactions for this company
  await prisma.transaction.deleteMany({ where: { companyId: company.id } });

  for (const tx of sampleTxs) {
    const delta =
      tx.type === "INCOME" || tx.type === "LOAN_RECEIVED" ? 1
      : tx.type === "LOAN_REPAYMENT" && tx.loanDirection === "INFLOW" ? 1
      : -1;

    runningBalance += delta * tx.amount;

    const date = new Date(now.getFullYear(), now.getMonth() - (tx.monthsAgo || 0), 15);

    await prisma.transaction.create({
      data: {
        companyId: company.id,
        addedById: tx.addedById,
        type: tx.type,
        category: tx.category || null,
        loanDirection: tx.loanDirection || null,
        amount: tx.amount,
        description: tx.description,
        date,
        runningBalance,
      },
    });
  }

  console.log("Seed complete!");
  console.log("\nTest accounts:");
  console.log("  Admin   — admin@fms.com / password123");
  console.log("  Partner — ahmed@fms.com / password123");
  console.log("  Partner — sara@fms.com  / password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
