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
  @ApiPropertyOptional({ description: 'DOC-04: the PO line this bill line receives (pur_order_item.poi_id) — goods came with the bill; the qty billed (base units) reduces what the PO still has pending and may not exceed it.' })
  @IsOptional() @IsUUID() poItemId?: string;
  @ApiPropertyOptional({ description: "DOC-08: the sister company sale line this purchase line pulls (sales.sale_bill_item.sbi_id) — see GET /purchase/sister-bills/lines." })
  @IsOptional() @IsUUID() sisterSaleItemId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(9) sisterSaleItemAccYear?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(9) poItemAccYear?: string;
  @ApiPropertyOptional({ description: 'ENT-04: the cost per billed unit INCLUDING GST / cess, as typed — the rate is back-solved from it (after disc % and scheme %); the answer\'s line rate is the result.' })
  @IsOptional() @IsNumber() @Min(0) costIncl?: number;
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
  @ApiPropertyOptional({ description: 'ENT-18: markup % on the cost without tax; with no sellA the server prices Sell A from it (GST added).' })
  @IsOptional() @IsNumber() markupAPct?: number;
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

/** The bill's transport band (public.txn_transport_detail, direction INWARD: FROM = the supplier, TO = our godown).
 *  Vehicle / driver are NOT in the band (house rule: crew and vehicle live on the document): vehicleNo / driverName
 *  ride in this object but are stored on pur_invoice (pi_vehicle_no / pi_driver_name). */
export class PurchaseTransportDto {
  @ApiPropertyOptional({ nullable: true, description: 'pur_invoice.pi_vehicle_no. Omit = keep the saved one; null / blank = clear.' })
  @IsOptional() @IsString() @MaxLength(20) vehicleNo?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'pur_invoice.pi_driver_name. Omit = keep the saved one; null / blank = clear.' })
  @IsOptional() @IsString() @MaxLength(100) driverName?: string | null;
  @ApiPropertyOptional({ enum: ['ROAD', 'RAIL', 'AIR', 'SHIP'] }) @IsOptional() @IsIn(['ROAD', 'RAIL', 'AIR', 'SHIP']) mode?: string;
  @ApiPropertyOptional({ description: 'public.transporter_master.trn_id' }) @IsOptional() @IsUUID() transporterId?: string;
  @ApiPropertyOptional({ description: 'Typed name; default = the transporter master\'s name.' }) @IsOptional() @IsString() @MaxLength(200) transporterName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) transporterGstin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) lrNo?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() lrDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) distanceKm?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) remarks?: string;
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
  @ApiPropertyOptional({ description: 'purchase.pur_agent.pag_id (= the agent\'s ledger, Agents master menu 28). Omit / null = no agent.' })
  @IsOptional() @IsUUID() agentId?: string | null;
  @ApiPropertyOptional({ description: "Bill from: which of the supplier's GSTINs the bill is from (the master's, or one of its ledger's BILL_TO / BOTH addresses — see supplier-context billFrom[]). Default the master's. Its state against the place of supply decides CGST+SGST vs IGST." })
  @IsOptional() @IsString() @MaxLength(15) billFromGstin?: string | null;
  @ApiPropertyOptional({ type: PurchaseTransportDto, nullable: true, description: 'Omit = keep the saved band and vehicle / driver; null = remove the band and clear vehicle / driver; an object = write the band (all blank = remove) — its vehicleNo / driverName are kept when absent.' })
  @IsOptional() @ValidateNested() @Type(() => PurchaseTransportDto) transport?: PurchaseTransportDto | null;
  @ApiPropertyOptional({ description: 'With post: go past the WARN items that need a right (needsRight = OVERRIDE, e.g. PUR_RATE_ABOVE_PO: no payment hold). Needs the Override right on menu 24; logged on the bill\'s trail.' })
  @IsOptional() @IsBoolean() overrideWarnings?: boolean;
  @ApiPropertyOptional({ description: 'Why the warnings were overridden — kept in the trail.' }) @IsOptional() @IsString() @MaxLength(250) overrideReason?: string;
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

export class PostPurchaseInvoiceDto {
  @ApiProperty() @IsUUID() piId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiPropertyOptional({ description: 'Go past the WARN items that need a right (Override on menu 24); logged.' }) @IsOptional() @IsBoolean() overrideWarnings?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(250) overrideReason?: string;
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

export class PurchaseInvoiceHoldDto {
  @ApiProperty() @IsUUID() piId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
  @ApiProperty({ description: 'true = put on payment hold; false = release (needs the Override right on menu 24).' }) @IsBoolean() hold!: boolean;
  @ApiProperty({ description: 'Why — kept on the bill and in its trail.' }) @IsString() @MaxLength(250) reason!: string;
}

export class PurchaseSettingsQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
}
