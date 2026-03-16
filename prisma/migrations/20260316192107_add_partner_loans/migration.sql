-- CreateTable
CREATE TABLE "PartnerLoan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerLoan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerLoan_companyId_userId_idx" ON "PartnerLoan"("companyId", "userId");

-- AddForeignKey
ALTER TABLE "PartnerLoan" ADD CONSTRAINT "PartnerLoan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerLoan" ADD CONSTRAINT "PartnerLoan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
