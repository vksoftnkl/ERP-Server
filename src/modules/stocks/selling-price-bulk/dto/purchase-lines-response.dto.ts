import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SellingPriceLineRowDto } from './selling-price-bulk-response.dto';

/** Change Selling Price P2 §7.2 — the Swagger shape of GET /stock/price-bulk/purchase-lines. */
export class FromBillLevelDto {
  @ApiProperty({ enum: [1, 2, 3, 4] })
  level!: number;

  @ApiProperty({ example: 1628 })
  price!: number;

  @ApiProperty({ enum: ['BILL', 'RULE', 'KEPT'], description: 'BILL typed on the bill · RULE the Profit Type · KEPT unchanged (By User, a 0 level, first cost, a sold-at level).' })
  from!: string;
}

export class FromBillProposalDto {
  @ApiProperty({ example: 1415.631, description: 'The new cost of ONE of the row\'s unit, with GST (6 dp).' })
  cost!: number;

  @ApiProperty({ example: 1348.22 })
  costWot!: number;

  @ApiProperty({ type: FromBillLevelDto, isArray: true, description: 'Levels 1–4, always all four.' })
  levels!: FromBillLevelDto[];

  @ApiPropertyOptional({ type: Number, nullable: true, description: "The bill's MSP (bought unit) when it changes the stored one, else null." })
  minPrice!: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, description: "Q11 — a plain item's bought-unit line takes the bill's MRP; else null." })
  maxPrice!: number | null;
}

export class FromBillChainDto {
  @ApiProperty({ format: 'uuid' })
  uomId!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'BOX' })
  unitName!: string | null;

  @ApiProperty({ example: 12, description: '"BOX ÷ 12" (SMALLER) or "PCS × 24" (BIGGER).' })
  factor!: number;

  @ApiProperty({ enum: ['SMALLER', 'BIGGER'] })
  way!: string;
}

export class FromBillLaterBillDto {
  @ApiProperty({ format: 'uuid' })
  piId!: string;

  @ApiProperty({ example: '2026-2027' })
  accYear!: string;

  @ApiProperty({ example: 'PUR/2026-2027/D8/00131' })
  refno!: string;

  @ApiProperty({ example: '2026-11-15' })
  docDate!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  branchName!: string | null;

  @ApiProperty({ example: 470, description: "That bill's landing cost of one of this row's unit, with GST." })
  cost!: number;
}

export class FromBillChangeDto {
  @ApiProperty({ example: '2026-11-25T10:20:00+05:30', description: 'When the line was changed (ISO, +05:30).' })
  at!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'VKPOS', description: 'The login that changed it; null when the log has none.' })
  who!: string | null;

  @ApiProperty({
    example: 'CHANGE_SELLING_PRICE',
    description:
      'Where it was changed (the price log source): CHANGE_SELLING_PRICE · ITEM_CARD · QTY_PRICE · PURCHASE · BULK_COST_CHANGE · IMPORT · BUCKET_REKEY — an open list.',
  })
  source!: string;
}

export class FromBillDto {
  @ApiProperty({
    example: 'BOUGHT',
    description:
      'BOUGHT / CHAIN / LATER_BILL / NO_PRICE — an OPEN list (MADE_FROM later, kit RP4): show an unknown kind grey and read-only with `words`.',
  })
  kind!: string;

  @ApiProperty({ type: Number, isArray: true, example: [1] })
  billLines!: number[];

  @ApiProperty({ example: 10, description: 'Billed qty of the bought line(s), in unitName (the BOUGHT unit).' })
  qty!: number;

  @ApiProperty({ example: 0 })
  freeQty!: number;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'BOX' })
  unitName!: string | null;

  @ApiProperty({ example: 1300 })
  rate!: number;

  @ApiProperty({ example: 1348.22, description: "The bill's landing cost of ONE of THIS row's unit, w/o GST." })
  landedCostWot!: number;

  @ApiProperty({ example: 1415.631 })
  landedCost!: number;

  @ApiPropertyOptional({ type: FromBillChainDto, nullable: true })
  chainFrom!: FromBillChainDto | null;

  @ApiPropertyOptional({ type: FromBillLaterBillDto, nullable: true })
  laterBill!: FromBillLaterBillDto | null;

  @ApiPropertyOptional({ type: FromBillProposalDto, nullable: true, description: 'Null on LATER_BILL.' })
  proposed!: FromBillProposalDto | null;

  @ApiProperty({ example: false })
  sameAsNow!: boolean;

  @ApiProperty({ example: '10 BOX · rate 1,300.00 · landing 1,348.22 + GST 5 %' })
  words!: string;

  @ApiPropertyOptional({
    type: FromBillChangeDto,
    nullable: true,
    description:
      "Review S3 — the latest change of this line after the bill's business time that this bill did not make itself (D16's " +
      'rule, not applied here: Save overwrites it). Null when none, and on a NO_PRICE row.',
  })
  changedSince!: FromBillChangeDto | null;
}

export class PurchaseViewRowDto extends SellingPriceLineRowDto {
  @ApiProperty({ type: FromBillDto })
  fromBill!: FromBillDto;
}

export class PurchaseViewBillDto {
  @ApiProperty({ format: 'uuid' }) piId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty() refno!: string;
  @ApiProperty({ example: '2026-11-12' }) docDate!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) supplierInvNo!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) supplierName!: string | null;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) branchName!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: '2026-11-23T10:42:00+05:30' }) postedOn!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, example: 'VKPOS' }) postedBy!: string | null;
  @ApiProperty({ enum: ['NONE', 'COST_ONLY', 'UPDATE_PRICES', 'OPEN_CHANGE_SELLING'] }) afterPurchase!: string;
  @ApiPropertyOptional({ type: String, nullable: true }) reviewedOn!: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) reviewedBy!: string | null;
}

export class PurchaseViewMetaDto {
  @ApiProperty() items!: number;
  @ApiProperty() lines!: number;
  @ApiProperty() bought!: number;
  @ApiProperty() chain!: number;
  @ApiProperty() laterBill!: number;
  @ApiProperty() noPrice!: number;
  @ApiProperty() toChange!: number;
  @ApiProperty({ description: 'Rows that are not LATER_BILL (the reopen button needs one).' }) latestLines!: number;
}

export class PurchaseViewDataDto {
  @ApiProperty({ type: PurchaseViewBillDto }) bill!: PurchaseViewBillDto;
  @ApiProperty({ type: PurchaseViewRowDto, isArray: true }) items!: PurchaseViewRowDto[];
  @ApiProperty({ type: PurchaseViewMetaDto }) meta!: PurchaseViewMetaDto;
}

export class PurchaseViewSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty({ example: 'PUR/2026-2027/D8/00123: 4 items, 7 lines' }) message!: string;
  @ApiProperty({ type: PurchaseViewDataDto }) data!: PurchaseViewDataDto;
}
