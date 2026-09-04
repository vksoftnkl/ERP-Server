import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  toTrimmedString,
} from 'src/common/dto/dtoDecorators';

export class SaveItemTaxDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing item tax slab',
  })
  @OptionalUuid()
  tax_id?: string;

  @ApiProperty({ maxLength: 100 })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  tax_name!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  tax_code?: string | null;

  @ApiPropertyOptional({ maxLength: 30, default: 'TAXABLE' })
  @OptionalTrimmedString(30)
  tax_taxability_type?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  tax_is_reverse_charge?: boolean;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_cgst_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_sgst_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_igst_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_cgst_pur_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_sgst_pur_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_igst_pur_perc?: number;

  @ApiPropertyOptional({ maxLength: 20, default: 'NONE' })
  @OptionalTrimmedString(20)
  tax_cess_type?: string;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_cess_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_cess_unit?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_cess_pur_perc?: number;

  @ApiPropertyOptional({ example: 0 })
  @OptionalNumber()
  tax_cess_pur_unit?: number;

  @ApiPropertyOptional({ example: 18 })
  @OptionalNumber()
  tax_gst_rate_total?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_sales_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_sales_return_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_purchase_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_purchase_return_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_cgst_output_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_sgst_output_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_igst_output_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_cess_output_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_cgst_input_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_sgst_input_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_igst_input_ledger_id?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  tax_cess_input_ledger_id?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  tax_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  tax_created_by?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  tax_modified_by?: string | null;
}
