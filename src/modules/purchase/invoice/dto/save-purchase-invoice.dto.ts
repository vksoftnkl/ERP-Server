import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** One stock-side row of a line (pur_item_alloc). Omit them all for the common case: one row, the header godown. */
export class PurchaseAllocDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() godownId?: string;
  @ApiPropertyOptional({ enum: ['SALEABLE', 'DAMAGED'] }) @IsOptional() @IsIn(['SALEABLE', 'DAMAGED']) bucket?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) batchNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() mfgDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() expiryDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() salePrice?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) serialNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() warrantyTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sizeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() colourId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) model?: string;
  @ApiProperty() @IsNumber() @Min(0) qty!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) freeQty?: number;
}

export class PurchaseInvoiceLineDto {
  @ApiProperty() @IsInt() @Min(1) lineNo!: number;
  @ApiProperty() @IsUUID() itemId!: string;
  @ApiProperty({ description: 'item_unit_conversion.iuc_id' }) @IsUUID() uomId!: string;
  @ApiPropertyOptional({ description: 'The GRN line this bill line bills (pur_grn_item.gri_id), whole. Unit, received / damaged / free and the batches come from it, locked; stock is already in (the bill revalues it — P13).' })
  @IsOptional() @IsUUID() grnItemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(9) grnItemAccYear?: string;
  @ApiProperty() @IsNumber() @Min(0) billedQty!: number;
  @ApiPropertyOptional({ description: 'Defaults to billed − damaged.' }) @IsOptional() @IsNumber() @Min(0) receivedQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) damagedQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) freeQty?: number;
  @ApiProperty() @IsNumber() @Min(0) rate!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discPerQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() discAmt?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() schPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() schPerQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() schAmt?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() extraDiscAmt?: number;
  @ApiPropertyOptional({ description: 'tax_rate_master.tax_id — the GST % is read from it.' }) @IsOptional() @IsUUID() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() cessPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() cessPerUnit?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() mrp?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sellA?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sellB?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sellC?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() sellD?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() markupAPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
  @ApiPropertyOptional({ type: [PurchaseAllocDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseAllocDto)
  allocs?: PurchaseAllocDto[];
}

export class PurchaseChargePayeeDto {
  @ApiProperty({ description: 'Ledger id (an employee\'s own ledger, a transporter …)' }) @IsUUID() partyId!: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() amount?: number;
}

export class PurchaseChargeDto {
  @ApiProperty({ description: 'charge_master.chg_id (module P / B)' }) @IsUUID() chgId!: string;
  @ApiPropertyOptional({ description: 'Per-unit rate / % / fixed amount; default = the master\'s.' }) @IsOptional() @IsNumber() rate?: number;
  @ApiPropertyOptional({ description: 'A typed amount wins over the method.' }) @IsOptional() @IsNumber() amount?: number;
  @ApiPropertyOptional({ type: [PurchaseChargePayeeDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseChargePayeeDto)
  payees?: PurchaseChargePayeeDto[];
}

export class PurchaseInvoiceHeaderDto {
  @ApiPropertyOptional({ description: 'Set to update a draft.' }) @IsOptional() @IsUUID() piId?: string;
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty({ example: '2026-2027' }) @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty({ description: 'fixed.device_master.dev_id — the number series.' }) @IsUUID() deviceId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() sessionId?: string;
  @ApiProperty({ description: 'The supplier = its ledger (sup_id = led_id).' }) @IsUUID() supplierId!: string;
  @ApiProperty() @IsString() @MaxLength(60) supplierInvNo!: string;
  @ApiProperty() @IsDateString() supplierInvDate!: string;
  @ApiProperty({ description: 'Our entry / posting date.' }) @IsDateString() docDate!: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() goodsReceivedOn?: string;
  @ApiProperty() @IsUUID() godownId!: string;
  @ApiPropertyOptional({ enum: ['CREDIT'] }) @IsOptional() @IsIn(['CREDIT', 'CASH']) mode?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) creditDays?: number;
  @ApiProperty({ description: 'The bill total as printed — compared with net payable.' }) @IsNumber() invoiceAmountPrinted!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) tcsAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) ewbNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() ewbDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64) irn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) ackNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) remarks?: string;
  @ApiPropertyOptional({ description: 'Save and post in one transaction.' }) @IsOptional() @IsBoolean() post?: boolean;
}

export class SavePurchaseInvoiceDto {
  @ApiProperty({ type: PurchaseInvoiceHeaderDto }) @ValidateNested() @Type(() => PurchaseInvoiceHeaderDto) header!: PurchaseInvoiceHeaderDto;
  @ApiProperty({ type: [PurchaseInvoiceLineDto] })
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => PurchaseInvoiceLineDto)
  lines!: PurchaseInvoiceLineDto[];
  @ApiPropertyOptional({ type: [PurchaseChargeDto] })
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PurchaseChargeDto)
  charges?: PurchaseChargeDto[];
}

export class GetPurchaseInvoiceQueryDto {
  @ApiProperty() @IsUUID() piId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}

export class CancelPurchaseInvoiceDto {
  @ApiProperty() @IsUUID() piId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty() @IsString() @MaxLength(250) reason!: string;
}

export class GrnLinesQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
  @ApiProperty() @IsUUID() supplierId!: string;
  @ApiPropertyOptional({ description: 'The draft being edited — its own GRN lines are listed as free.' }) @IsOptional() @IsUUID() piId?: string;
}

export class PurchaseSettingsQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
}
