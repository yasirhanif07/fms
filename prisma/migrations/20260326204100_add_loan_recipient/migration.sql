-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "loanRecipientId" TEXT;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_loanRecipientId_fkey" FOREIGN KEY ("loanRecipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
