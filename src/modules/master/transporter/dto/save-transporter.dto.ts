import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { NullableStringStrict, OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';

export const TRANSPORT_MODES = ['ROAD', 'RAIL', 'AIR', 'SHIP'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

/**
 * POST /transporters/save (plan §5.2). No trnId = create (and its ledger). Full
 * replace: an optional key left out is stored as null. No ledger key: the ledger
 * is never chosen, it is the transporter's own (D28).
 */
export class SaveTransporterDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update that transporter (= its ledger id).' })
  @OptionalUuid()
  trnId?: string;

  @ApiProperty({ format: 'uuid', description: 'Must be the login company (D25).' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  code?: string | null;

  @ApiProperty({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: 'GSTIN, or a TRANSIN when isEnrolmentId; the server refuses anything but 15 letters and digits (TRN_GSTIN_INVALID).' })
  @NullableStringStrict(20)
  gstin?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isEnrolmentId?: boolean;

  @ApiPropertyOptional({ enum: TRANSPORT_MODES, default: 'ROAD' })
  @IsOptional()
  @IsIn(TRANSPORT_MODES)
  mode?: TransportMode;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  addr?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  place?: string | null;

  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  pin?: string | null;

  @ApiPropertyOptional({ maxLength: 2, nullable: true, description: 'fixed.state_codes.state_code' })
  @NullableStringStrict(2)
  stateCode?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  remarks?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
