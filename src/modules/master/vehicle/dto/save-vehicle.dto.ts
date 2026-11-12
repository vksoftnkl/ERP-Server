import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { NullableStringStrict, NullableUuid, OptionalUuid, RequiredUuid } from 'src/common/dto/dtoDecorators';

export const VEHICLE_TYPES = ['REGULAR', 'ODC'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

/**
 * POST /vehicles/save (plan §5.1). No vehId = create. Full replace: an optional
 * key left out is stored as null; isActive left out = true, isOwn left out = true.
 */
export class SaveVehicleDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Present = update that vehicle.' })
  @OptionalUuid()
  vehId?: string;

  @ApiProperty({ format: 'uuid', description: 'Must be the login company (D25).' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Home branch (label + list filter only).' })
  @NullableUuid()
  branchId?: string | null;

  @ApiProperty({ example: 'tn 38 ab-1234', description: 'Cleaned by the server: capitals; spaces, - . / removed.' })
  @IsString()
  @MaxLength(40)
  vehicleNo!: string;

  @ApiProperty({ enum: VEHICLE_TYPES, default: 'REGULAR' })
  @IsIn(VEHICLE_TYPES)
  type!: VehicleType;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableStringStrict(150)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 0, maximum: 999999999.999 })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber({ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(999999999.999)
  capacityKg?: number | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isOwn?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Stored NULL for an own vehicle (D23).' })
  @NullableUuid()
  transporterId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  driverId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
