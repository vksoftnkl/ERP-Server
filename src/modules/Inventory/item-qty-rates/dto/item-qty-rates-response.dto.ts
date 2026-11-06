import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ItemQtyPricePayloadDto } from '../../items-qty-price-master/dto/item-qty-price-response.dto';

/** Swagger only — the shapes are types/item-qty-rates.types.ts. */

export class QtyRatesItemDto {
  @ApiProperty({ format: 'uuid' }) itemId!: string;
  @ApiProperty({ nullable: true, type: String }) itemCode!: string | null;
  @ApiProperty() itemName!: string;
  @ApiProperty({ nullable: true, type: String }) barcode!: string | null;
  @ApiProperty() taxPerc!: number;
  @ApiProperty() inclTax!: boolean;
  @ApiProperty() hasCess!: boolean;
  @ApiProperty() plainStock!: boolean;
  @ApiProperty({ example: 'Plain stock' }) trackedAs!: string;
  @ApiProperty({
    nullable: true,
    enum: ['INACTIVE', 'NOT_PLAIN_STOCK', 'OLD_BATCH_TICK'],
  })
  leftOutReason!: string | null;
}

export class QtyRatesRightsDto {
  @ApiProperty() view!: boolean;
  @ApiProperty() createSlab!: boolean;
  @ApiProperty() editSlab!: boolean;
  @ApiProperty() deleteSlab!: boolean;
  @ApiProperty({ description: 'Menu 30 (Change Selling Price) EDIT.' }) editCard!: boolean;
  @ApiProperty({ description: 'isHqUserType — a slab for all branches (Q9).' })
  allBranchSlab!: boolean;
}

export class QtyRatesLevelDto {
  @ApiProperty() level!: number;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true, type: String }) short!: string | null;
}

export class QtyRatesUnitLevelDto {
  @ApiProperty() level!: number;
  @ApiProperty() price!: number;
  @ApiProperty() priceWot!: number;
  @ApiProperty({ description: 'Against cardCost.' }) markupPerc!: number;
}

export class QtyRatesUnitDto {
  @ApiProperty() lineNo!: number;
  @ApiProperty({ format: 'uuid', description: 'iuc_id' }) uomId!: string;
  @ApiProperty({ nullable: true, type: String }) unitName!: string | null;
  @ApiProperty() unitSlno!: number;
  @ApiProperty({ nullable: true, type: String }) parentUomId!: string | null;
  @ApiProperty({ nullable: true, type: String }) parentUnitName!: string | null;
  @ApiProperty({ nullable: true, type: Number }) unitsPerParent!: number | null;
  @ApiProperty() factorsAgree!: boolean;
  @ApiProperty({ nullable: true, type: String }) bucketId!: string | null;
  @ApiProperty({ nullable: true, enum: ['BRANCH', 'CHAIN'] }) priceScope!: string | null;
  @ApiProperty({ enum: ['BUCKET', 'MASTER'] }) priceSource!: string;
  @ApiProperty({ nullable: true, type: Number }) mrp!: number | null;
  @ApiProperty({ nullable: true, type: Number }) salePrice!: number | null;
  @ApiProperty() maxPrice!: number;
  @ApiProperty() stockQty!: number;
  @ApiProperty() costRate!: number;
  @ApiProperty() costWot!: number;
  @ApiProperty({ nullable: true, enum: ['MRP', 'ITEM', 'PRICE_ROW'] }) costBasis!: string | null;
  @ApiProperty({ nullable: true, type: Number }) stockAvg!: number | null;
  @ApiProperty({ nullable: true, type: Number }) rowCost!: number | null;
  @ApiProperty({ nullable: true, type: Number }) rowCostWot!: number | null;
  @ApiProperty() cardCost!: number;
  @ApiProperty({ nullable: true, type: String }) profitType!: string | null;
  @ApiProperty() roundOff!: number;
  @ApiProperty() minPrice!: number;
  @ApiProperty({ type: QtyRatesUnitLevelDto, isArray: true }) levels!: QtyRatesUnitLevelDto[];
  @ApiProperty() costEditable!: boolean;
  @ApiProperty() mrpEditable!: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date' }) scheduledFrom!: string | null;
}

export class QtyRatesViewDto {
  @ApiProperty({ type: QtyRatesItemDto }) item!: QtyRatesItemDto;
  @ApiProperty({ type: QtyRatesRightsDto }) rights!: QtyRatesRightsDto;
  @ApiProperty({ enum: ['restrict', 'warning', 'allow'] }) belowCostPolicy!: string;
  @ApiProperty({ format: 'date' }) today!: string;
  @ApiProperty({ type: QtyRatesLevelDto, isArray: true }) levels!: QtyRatesLevelDto[];
  @ApiProperty({ type: QtyRatesUnitDto, isArray: true }) units!: QtyRatesUnitDto[];
  @ApiProperty({ type: ItemQtyPricePayloadDto, isArray: true }) slabs!: ItemQtyPricePayloadDto[];
}

export class QtyRatesProblemDto {
  @ApiProperty({ enum: ['CARD', 'SLAB'] }) source!: string;
  @ApiProperty({ example: 'ITEM_QTY_PRICE_BELOW_COST' }) code!: string;
  @ApiProperty({ enum: ['REFUSE', 'ASK', 'INFO'] }) severity!: string;
  @ApiProperty({ nullable: true, type: Number }) lineNo!: number | null;
  @ApiProperty({ nullable: true, type: Number }) slabIndex!: number | null;
  @ApiProperty({ nullable: true, type: String }) iqpId!: string | null;
  @ApiProperty() uomId!: string;
  @ApiProperty({ nullable: true, type: String }) unitName!: string | null;
  @ApiProperty({ nullable: true, type: Number }) level!: number | null;
  @ApiProperty({ nullable: true, type: Number }) price!: number | null;
  @ApiProperty({ nullable: true, type: Number }) cost!: number | null;
  @ApiProperty() field!: string;
  @ApiProperty() message!: string;
}

export class QtyRatesSaveResultDto {
  @ApiProperty() needsConfirm!: boolean;
  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    description: 'What POST /stock/price-bulk answers for the card rows; null with none.',
  })
  rates!: Record<string, unknown> | null;
  @ApiProperty({ type: ItemQtyPricePayloadDto, isArray: true }) slabs!: ItemQtyPricePayloadDto[];
  @ApiProperty({ type: String, isArray: true }) deletedSlabIds!: string[];
  @ApiProperty({ type: QtyRatesProblemDto, isArray: true }) problems!: QtyRatesProblemDto[];
  @ApiProperty({ enum: ['restrict', 'warning', 'allow'] }) belowCostPolicy!: string;
}

export class QtyRatesViewSuccessDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() message!: string;
  @ApiProperty({ type: QtyRatesViewDto }) data!: QtyRatesViewDto;
}

export class QtyRatesSaveSuccessDto {
  @ApiProperty({ example: true }) success!: boolean;
  @ApiProperty() message!: string;
  @ApiProperty({ type: QtyRatesSaveResultDto }) data!: QtyRatesSaveResultDto;
}
