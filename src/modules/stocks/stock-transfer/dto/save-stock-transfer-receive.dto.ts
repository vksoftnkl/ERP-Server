import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, Matches, ValidateNested } from 'class-validator';
import { RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';

const MAX_LINES = 500;
const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;

/**
 * The receipt half — TRANSFER_IN, raised at the DESTINATION branch.
 *
 * IT IS NOT A COPY OF THE DESPATCH. What is still owed lives in stock_transit,
 * not in the OUT's lines, so the grid is opened from
 * GET /stock/transfer/receive/prefill and a second partial receipt opens with
 * the REMAINDER. Prefilling from the OUT's lines is the bug that lets a clerk
 * receive 30 twice.
 *
 * THE LINK IS MANDATORY AND IS RE-DECLARED HERE, unlike the godowns.
 * `linkSrcDocId` and `linkSrcAccYear` carry @NullableUuid / @NullableDateString
 * on the base rather than @IsOptional(), so a @RequiredUuid() here does fire —
 * and it must, because ck_svh_transfer_in_link enforces the id at the database
 * and fn_svh_receive_transfer checks the module and doc type by hand. A receipt
 * that names no despatch is not a receipt.
 *
 * `linkSrcModule` and `linkSrcDocType` are NOT taken from the payload at all:
 * the service stamps 'STOCK' / 'STOCK_VOUCHER'. There is nothing to choose.
 */
export class SaveStockTransferReceiveHeaderDto extends SaveStockVoucherHeaderDto {
  @ApiPropertyOptional({
    enum: ['TRANSFER_IN'],
    description: 'Optional, and only ever "TRANSFER_IN". The route decides the type.',
  })
  @IsOptional()
  @IsIn(['TRANSFER_IN'], {
    message:
      'voucherType must be TRANSFER_IN on this route. A despatch is raised at the sending branch through /stock/transfer.',
  })
  voucherType?: 'TRANSFER_IN';

  @ApiProperty({
    format: 'uuid',
    description:
      'The TRANSFER_OUT this receipt is against. Required — ck_svh_transfer_in_link, and the engine refuses a receipt that links nothing.',
  })
  @RequiredUuid()
  declare linkSrcDocId: string;

  @ApiProperty({
    example: '2026-2027',
    minLength: 9,
    maxLength: 9,
    description:
      "The DESPATCH's accounting year, which is not always the receipt's: a lorry that leaves on 29 March arrives in the next year. stock_transit carries both halves' years separately for exactly this reason.",
  })
  @TrimmedString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'linkSrcAccYear must be YYYY-YYYY, e.g. 2026-2027' })
  declare linkSrcAccYear: string;
}

/**
 * FOUR THINGS THE RECEIPT LINE MEANS DIFFERENTLY FROM THE DESPATCH LINE:
 *
 *   godownId  the DESTINATION godown — the opposite of the OUT line's meaning.
 *             Take it from the prefill's toGodownId, never from a picker. The
 *             matcher is (out voucher, item, lot, godownId = stt_to_godown_id).
 *   lotId     required, and it must be the lot that is actually in transit.
 *   bucket    SALEABLE for what arrived good, DAMAGED for what arrived broken.
 *             Damaged units still POST IN — they exist, broken — and land in
 *             the destination's DAMAGED bucket as stt_damage_qty.
 *   qty       may not exceed the transit row's remaining quantity.
 *
 * WHAT NEVER ARRIVED GETS NO LINE. A short is not keyed, it is what remains
 * unkeyed — there is no zero-quantity line for it and no "short" field.
 */
export class SaveStockTransferReceiveDto {
  @ApiProperty({ type: SaveStockTransferReceiveHeaderDto })
  @ValidateNested()
  @Type(() => SaveStockTransferReceiveHeaderDto)
  header!: SaveStockTransferReceiveHeaderDto;

  @ApiProperty({
    type: SaveStockVoucherItemDto,
    isArray: true,
    description:
      'One line per transit row actually received. godownId is the DESTINATION here. What never arrived gets no line at all.',
  })
  @IsArray()
  @ArrayMaxSize(MAX_LINES, {
    message: `lines may not exceed ${MAX_LINES} rows in one document`,
  })
  @ValidateNested({ each: true })
  @Type(() => SaveStockVoucherItemDto)
  lines!: SaveStockVoucherItemDto[];
}
