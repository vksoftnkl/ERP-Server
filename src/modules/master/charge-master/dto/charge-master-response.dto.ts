import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CHARGE_APPLY_ONS,
  CHARGE_COST_ALLOCS,
  CHARGE_METHODS,
  CHARGE_MODULES,
  CHARGE_ROLES,
  CHARGE_TYPES,
} from '../types/charge-master-api.types';
export class ChargeMasterErrorFieldDto {
  @ApiProperty({ example: 'chgName' })
  field!: string;
  @ApiProperty({ example: 'chgName must not be empty' })
  message!: string;
}
export class ChargeMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: ChargeMasterErrorFieldDto, isArray: true })
  errors!: ChargeMasterErrorFieldDto[];
}
export class ChargeMasterPayloadDto {
  @ApiProperty({ format: 'uuid' })
  chgId!: string;
  @ApiProperty({ maxLength: 100 })
  chgName!: string;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  chgCode!: string | null;
  @ApiProperty({ enum: CHARGE_MODULES })
  chgModule!: string;
  @ApiPropertyOptional({ enum: CHARGE_ROLES, nullable: true })
  chgRole!: string | null;
  @ApiProperty({ enum: CHARGE_METHODS })
  chgMethod!: string;
  @ApiProperty({ enum: CHARGE_TYPES })
  chgType!: string;
  @ApiProperty({ enum: CHARGE_APPLY_ONS })
  chgApplyOn!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  chgDefaultRate!: number | null;
  @ApiProperty()
  chgLandingCost!: boolean;
  @ApiPropertyOptional({ enum: CHARGE_COST_ALLOCS, nullable: true })
  chgCostAlloc!: string | null;
  @ApiProperty({ format: 'uuid' })
  chgLedgerCode!: string;
  @ApiPropertyOptional({ maxLength: 200, nullable: true, description: 'Name of the mapped GL ledger' })
  chgLedgerName!: string | null;
  @ApiProperty()
  chgTaxApl!: boolean;
  @ApiProperty()
  chgBeforeTax!: boolean;
  @ApiProperty()
  chgSepPost!: boolean;
  @ApiProperty()
  chgManParty!: boolean;
  @ApiPropertyOptional({ nullable: true, type: Number })
  chgDispOrder!: number | null;
  @ApiProperty()
  chgAutoApply!: boolean;
  @ApiProperty()
  chgIsActive!: boolean;
  @ApiProperty()
  chgIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  chgSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  chgCreatedOn!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  chgCreatedBy!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  chgModifiedOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  chgModifiedBy!: string | null;
}
export class ChargeMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 3 })
  total!: number;
  @ApiProperty({ example: 1 })
  total_pages!: number;
}
export class ChargeMasterDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  chgId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class ChargeMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Charge fetched successfully' })
  message!: string;
  @ApiProperty({ type: ChargeMasterPayloadDto })
  data!: ChargeMasterPayloadDto;
}
export class ChargeMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Charges fetched successfully' })
  message!: string;
  @ApiProperty({ type: ChargeMasterPayloadDto, isArray: true })
  data!: ChargeMasterPayloadDto[];
  @ApiProperty({ type: ChargeMasterListMetaDto })
  meta!: ChargeMasterListMetaDto;
}
export class ChargeMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Charge deleted successfully' })
  message!: string;
  @ApiProperty({ type: ChargeMasterDeleteResultDto })
  data!: ChargeMasterDeleteResultDto;
}