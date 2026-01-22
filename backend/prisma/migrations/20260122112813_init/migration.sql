-- AlterTable
ALTER TABLE `ledgerrow` ADD COLUMN `LatePaymentSurcharge` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `surchargeBalanceBase` INTEGER NULL,
    ADD COLUMN `surchargeCyclesApplied` INTEGER NOT NULL DEFAULT 0;
