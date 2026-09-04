import { Module } from '@nestjs/common';
import { TransactionController } from './transaction.controller';
import { TransactionExceptionFilter } from './transaction-exception.filter';
import { TransactionService } from './transaction.service';

/**
 * Settlement reads and writes over `accounts.acc_bill_balance` /
 * `acc_bill_adjustment`. Today it owns one read — the credits a party may adjust
 * against a bill — which the sale bill, receipt and credit-note screens all
 * feed their adjustment panel from.
 *
 * The service is exported because those screens post the adjustments as part of
 * their own save, inside the caller's transaction; a second copy of the credit
 * lookup would drift from this one.
 */
@Module({
  controllers: [TransactionController],
  providers: [TransactionService, TransactionExceptionFilter],
  exports: [TransactionService],
})
export class TransactionModule {}
