import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { toNullableString } from 'src/common/dto/dto-transforms';
export class SaveSupplierGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing supplier group',
  })
  @IsOptional()
  @IsUUID('all')
  spgId?: string;
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  spgName!: string;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(150)
  spgAlias?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(50)
  spgShort?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(250)
  spgDesc?: string | null;
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  spgIsActive?: boolean;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  spgCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @IsOptional()
  @Transform(({ value }) => toNullableString(value))
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(100)
  spgModifiedBy?: string | null;
}
