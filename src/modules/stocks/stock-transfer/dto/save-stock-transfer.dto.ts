import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';

const MAX_LINES = 500;

/**
 * THE VOUCHER TYPE IS NEVER TAKEN FROM THE PAYLOAD — the controller pins
 * 'TRANSFER_OUT'. Declared only so a payload naming something else is refused
 * with a field message rather than silently ignored.
 *
 * ONE ENDPOINT, TWO SCREENS. Form 3 (godown → godown) and form 4 (branch →
 * branch) post the same body; the only difference is whether `toBranchId` is
 * present, and the ENGINE decides the shape from it:
 *
 *     v_same := svh_to_branch_id IS NULL OR svh_to_branch_id = svh_branch_id
 *
 * Same branch writes the OUT and IN ledger rows as a pair in one transaction
 * and the voucher ends POSTED; another branch writes the OUT row plus a
 * stock_transit row per line and the voucher ends IN_TRANSIT. Building two
 * modules for that is how the second one drifts, and the drift lands in the
 * ledger.
 *
 * WHY THE REQUIRED FIELDS ARE NOT RE-DECLARED HERE. `fromGodownId` and
 * `toGodownId` are both mandatory on a transfer (ck_svh_transfer_godowns), but
 * the base carries @IsOptional() on them, and @IsOptional() whitelists
 * undefined for every validator on the property — a @RequiredUuid() added here
 * would never fire. They are enforced in StockVoucherService.assertPayloadRules
 * off requiresFromGodown / requiresToGodown, which answers 422 alongside every
 * other per-line problem instead of one field error at a time.
 */
export class SaveStockTransferHeaderDto extends SaveStockVoucherHeaderDto {
  @ApiPropertyOptional({
    enum: ['TRANSFER_OUT'],
    description: 'Optional, and only ever "TRANSFER_OUT". The route decides the type.',
  })
  @IsOptional()
  @IsIn(['TRANSFER_OUT'], {
    message:
      'voucherType must be TRANSFER_OUT on this route. A receipt is raised at the destination through /stock/transfer/receive.',
  })
  voucherType?: 'TRANSFER_OUT';
}

/**
 * Standalone rather than extending SaveStockVoucherDto, for the same reason the
 * opening's is: the only difference is which class `header` transforms into,
 * and re-declaring an inherited field to change its @Type() is a TS2612.
 * Structurally assignable to SaveStockVoucherDto.
 *
 * THE LINE SHAPE IS THE SHARED ONE, with two rules the service applies:
 *
 *   lotId    REQUIRED (requiresLot). A transfer moves existing stock — the
 *            grid was filled from stock_balance, so the client already has it.
 *            fn_slt_resolve is never called on this path.
 *   godownId the SOURCE godown of the line. The destination is on the HEADER,
 *            and at receipt this flips — see the receive DTO.
 *
 * NEVER SEND A COST. svi_cost_rate is stripped to 0 before insert
 * (zeroesLineCost) so fn_sml_cost_default can stamp the policy cost, which then
 * travels to the IN row and the transit row. A nonzero rate makes that trigger
 * bail AND 20's OUT insert omits the value columns, so the ledger row lands at
 * the typed rate with value 0.
 */
export class SaveStockTransferDto {
  @ApiProperty({ type: SaveStockTransferHeaderDto })
  @ValidateNested()
  @Type(() => SaveStockTransferHeaderDto)
  header!: SaveStockTransferHeaderDto;

  @ApiProperty({
    type: SaveStockVoucherItemDto,
    isArray: true,
    description:
      'A full replace on update. Every line names the lot it moves and the SOURCE godown it moves from.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, {
    message: `lines may not exceed ${MAX_LINES} rows in one document`,
  })
  @ValidateNested({ each: true })
  @Type(() => SaveStockVoucherItemDto)
  lines!: SaveStockVoucherItemDto[];
}
