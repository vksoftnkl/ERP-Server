import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import {
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUpperMaxString,
  OptionalBoolean,
  OptionalUpperMaxString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import {
  CHARGE_APPLY_ONS,
  CHARGE_COST_ALLOCS,
  CHARGE_METHODS,
  CHARGE_MODULES,
  CHARGE_ROLES,
  CHARGE_TYPES,
} from '../types/charge-master-api.types';
export class SaveChargeMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing charge',
  })
  @OptionalUuid()
  chgId?: string;
  @ApiProperty({ maxLength: 100, example: 'Freight' })
  @TrimmedString(100)
  @IsNotEmpty()
  chgName!: string;
  @ApiPropertyOptional({ maxLength: 50, nullable: true, description: 'Business code (unique)' })
  @NullableStringStrict(50)
  chgCode?: string | null;
  @ApiProperty({ enum: CHARGE_MODULES, description: "'P'urchase / 'S'ales / 'B'oth" })
  @UpperMaxString(1)
  @IsIn(CHARGE_MODULES)
  chgModule!: string;
  @ApiPropertyOptional({ enum: CHARGE_ROLES, nullable: true })
  @NullableUpperMaxString(15)
  @IsIn(CHARGE_ROLES, { message: `chgRole must be one of: ${CHARGE_ROLES.join(', ')}` })
  chgRole?: string | null;
  @ApiProperty({ enum: CHARGE_METHODS })
  @UpperMaxString(10)
  @IsIn(CHARGE_METHODS)
  chgMethod!: string;
  @ApiPropertyOptional({ enum: CHARGE_TYPES, default: 'ADD' })
  @OptionalUpperMaxString(10)
  @IsIn(CHARGE_TYPES)
  chgType?: string;
  @ApiProperty({ enum: CHARGE_APPLY_ONS })
  @UpperMaxString(10)
  @IsIn(CHARGE_APPLY_ONS)
  chgApplyOn!: string;
  @ApiPropertyOptional({ nullable: true, default: 0, description: 'Optional default rate/%' })
  @NullableNumber()
  chgDefaultRate?: number | null;
  @ApiPropertyOptional({ default: false, description: 'Purchase only' })
  @OptionalBoolean()
  chgLandingCost?: boolean;
  @ApiPropertyOptional({ enum: CHARGE_COST_ALLOCS, nullable: true })
  @NullableUpperMaxString(10)
  @IsIn(CHARGE_COST_ALLOCS, { message: `chgCostAlloc must be one of: ${CHARGE_COST_ALLOCS.join(', ')}` })
  chgCostAlloc?: string | null;
  @ApiProperty({ format: 'uuid', description: 'GL ledger mapping' })
  @RequiredUuid()
  chgLedgerCode!: string;
  @ApiPropertyOptional({ default: false, description: 'Charge itself taxable' })
  @OptionalBoolean()
  chgTaxApl?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Deduct/add before tax calc?' })
  @OptionalBoolean()
  chgBeforeTax?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Post to own ledger vs absorb' })
  @OptionalBoolean()
  chgSepPost?: boolean;
  @ApiPropertyOptional({ default: false, description: 'Requires a party (e.g. freight vendor)' })
  @OptionalBoolean()
  chgManParty?: boolean;
  @ApiPropertyOptional({ nullable: true, default: 0, description: 'Grid ordering' })
  @NullableInteger()
  chgDispOrder?: number | null;
  @ApiPropertyOptional({ default: false, description: 'Auto-load into new entry' })
  @OptionalBoolean()
  chgAutoApply?: boolean;
  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  chgIsActive?: boolean;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Audit user who created the charge; defaults to the authenticated user when omitted',
  })
  @OptionalUuid()
  chgCreatedBy?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Audit user who last modified the charge; defaults to the authenticated user when omitted',
  })
  @OptionalUuid()
  chgModifiedBy?: string;
}