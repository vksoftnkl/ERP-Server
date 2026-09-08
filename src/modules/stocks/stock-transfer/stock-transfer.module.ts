import { Module } from '@nestjs/common';
import { StockVoucherModule } from '../stock-voucher/stock-voucher.module';
import { StockTransferController } from './stock-transfer.controller';
import { StockTransferReceiveController } from './stock-transfer-receive.controller';
import { StockTransferService } from './stock-transfer.service';

/**
 * BOTH TRANSFER FORMS AND BOTH HALVES, in one module.
 *
 * Forms 3 (godown → godown) and 4 (branch → branch) are ONE endpoint set and
 * two screens: the document, the lines, the validation and the despatch call
 * are identical, and only `toBranchId` and the screen differ. The engine picks
 * the shape itself —
 *
 *     v_same := svh_to_branch_id IS NULL OR svh_to_branch_id = svh_branch_id
 *
 * — so a `godown-transfer` module beside a `branch-transfer` module would be
 * two implementations of one rule, and the second one drifts. The drift lands
 * in the ledger.
 *
 * The despatch and the receipt DO get their own controllers, because they are
 * genuinely two documents raised at two branches with two engine functions and
 * two rule records — and because `svi_godown_id` means the source on one and
 * the destination on the other.
 */
@Module({
  imports: [StockVoucherModule],
  controllers: [StockTransferController, StockTransferReceiveController],
  providers: [StockTransferService],
  exports: [StockTransferService],
})
export class StockTransferModule {}
