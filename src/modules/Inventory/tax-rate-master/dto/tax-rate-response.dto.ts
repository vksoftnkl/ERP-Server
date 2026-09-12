import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InventoryErrorFieldDto,
  InventoryErrorResponseDto,
} from 'src/common/utils/module-response.dto';

export { InventoryErrorFieldDto as TaxRateErrorFieldDto };
export { InventoryErrorResponseDto as TaxRateErrorResponseDto };

export class TaxRateLedgerPayloadDto {
  @ApiProperty({ format: 'uuid' })
  trl_id!: string;
  @ApiProperty({ format: 'uuid' })
  trl_tax_id!: string;
  @ApiProperty({ maxLength: 30, example: 'OUTPUT_CGST' })
  trl_role!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'Output CGST',
    description: 'acc_ledger_role.alr_label — resolved on the read paths, ignored on write',
  })
  trl_role_label?: string | null;
  @ApiPropertyOptional({ nullable: true, enum: ['INTRA', 'INTER'], example: null })
  trl_supply_nature!: string | null;
  @ApiProperty({ format: 'uuid' })
  trl_ledger_id!: string;
  @ApiPropertyOptional({
    nullable: true,
    example: 'CGST Output',
    description: 'acc_ledger_master.led_name — resolved on the read paths, ignored on write',
  })
  trl_ledger_name?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  trl_remarks!: string | null;
  @ApiProperty({ example: true })
  trl_is_active!: boolean;
  @ApiProperty({ example: false })
  trl_is_deleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  trl_sync_date!: string | null;
  @ApiProperty()
  trl_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  trl_created_by!: string | null;
  @ApiPropertyOptional({ nullable: true })
  trl_modified_on!: string | null;
  @ApiPropertyOptional({ nullable: true })
  trl_modified_by!: string | null;
}

export class TaxRatePayloadDto {
  @ApiProperty({ format: 'uuid', example: '019c6f6c-be87-7a11-8905-36092c46fd06' })
  tax_id!: string;
  @ApiProperty({ maxLength: 100, example: 'GST 18%' })
  tax_name!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true, example: 'GST18' })
  tax_code!: string | null;
  @ApiProperty({ example: 60 })
  tax_sort_order!: number;
  @ApiProperty({ maxLength: 15, example: 'TAXABLE' })
  tax_taxability!: string;
  @ApiProperty({ example: false })
  tax_is_reverse_charge!: boolean;
  @ApiProperty({ example: 18, description: 'The total GST rate' })
  tax_rate_perc!: number;
  @ApiPropertyOptional({
    nullable: true,
    example: 9,
    description: 'GENERATED from tax_rate_perc by the database — read-only',
  })
  tax_cgst_perc!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 9, description: 'GENERATED — read-only' })
  tax_sgst_perc!: number | null;
  @ApiPropertyOptional({ nullable: true, example: 18, description: 'GENERATED — read-only' })
  tax_igst_perc!: number | null;
  @ApiProperty({ maxLength: 10, example: 'NONE' })
  tax_cess_basis!: string;
  @ApiProperty({ example: 0 })
  tax_cess_perc!: number;
  @ApiProperty({ example: 0 })
  tax_cess_per_unit!: number;
  @ApiProperty({ maxLength: 10, example: 'NONE' })
  tax_acess_basis!: string;
  @ApiProperty({ example: 0 })
  tax_acess_perc!: number;
  @ApiProperty({ example: 0 })
  tax_acess_per_unit!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tax_supersedes_id!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    example: 'GST 12%',
    description: 'Name of the superseded rate — resolved on the read paths, ignored on write',
  })
  tax_supersedes_name?: string | null;
  @ApiProperty({ example: true })
  tax_is_active!: boolean;
  @ApiProperty({ example: false })
  tax_is_deleted!: boolean;
  @ApiPropertyOptional({ nullable: true })
  tax_sync_date!: string | null;
  @ApiProperty()
  tax_created_on!: string;
  @ApiPropertyOptional({ nullable: true })
  tax_created_by!: string | null;
  @ApiPropertyOptional({ nullable: true })
  tax_modified_on!: string | null;
  @ApiPropertyOptional({ nullable: true })
  tax_modified_by!: string | null;
  @ApiProperty({
    type: TaxRateLedgerPayloadDto,
    isArray: true,
    description: 'The ledger overrides. Empty is the normal case, not a misconfiguration.',
  })
  lines!: TaxRateLedgerPayloadDto[];
}

export class TaxRateDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  tax_id!: string;
  @ApiProperty({ example: true })
  deleted!: boolean;
  @ApiProperty({ example: 2, description: 'Live ledger overrides deleted with the header' })
  lines_deleted!: number;
}

export class TaxRateSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tax rate fetched successfully' })
  message!: string;
  @ApiProperty({ type: TaxRatePayloadDto })
  data!: TaxRatePayloadDto;
}

export class TaxRateSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tax rates fetched successfully' })
  message!: string;
  @ApiProperty({ type: TaxRatePayloadDto, isArray: true })
  data!: TaxRatePayloadDto[];
}

export class TaxRateSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tax rate deleted successfully' })
  message!: string;
  @ApiProperty({ type: TaxRateDeleteResultDto })
  data!: TaxRateDeleteResultDto;
}

export class TaxRateResolvedLedgerDto {
  @ApiProperty({ maxLength: 30, example: 'OUTPUT_CGST' })
  role!: string;
  @ApiProperty({ example: 'Output CGST' })
  role_label!: string;
  @ApiProperty({ example: 'OUTPUT_TAX', description: 'acc_ledger_role.alr_group' })
  role_group!: string;
  @ApiPropertyOptional({ nullable: true, enum: ['INTRA', 'INTER'], example: null })
  supply_nature!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  ledger_id!: string | null;
  @ApiPropertyOptional({ nullable: true, example: 'CGST Output' })
  ledger_name!: string | null;
  @ApiProperty({
    enum: ['OVERRIDE', 'DEFAULT', 'UNMAPPED'],
    example: 'DEFAULT',
    description:
      'OVERRIDE — this rate carries a row of its own. DEFAULT — it inherits ' +
      'accounts.acc_ledger_map. UNMAPPED — nothing answers, and a voucher touching this role ' +
      'cannot be posted yet.',
  })
  source!: 'OVERRIDE' | 'DEFAULT' | 'UNMAPPED';
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'trl_id or alm_id — the row that answered.',
  })
  source_row_id!: string | null;
}

export class TaxRateResolutionDto {
  @ApiProperty({ format: 'uuid' })
  tax_id!: string;
  @ApiProperty({ example: 'GST 18%' })
  tax_name!: string;
  @ApiPropertyOptional({ nullable: true, enum: ['INTRA', 'INTER'], example: null })
  supply_nature!: string | null;
  @ApiProperty({ type: TaxRateResolvedLedgerDto, isArray: true })
  roles!: TaxRateResolvedLedgerDto[];
}

export class TaxRateSuccessResolveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tax rate ledgers resolved successfully' })
  message!: string;
  @ApiProperty({ type: TaxRateResolutionDto })
  data!: TaxRateResolutionDto;
}
