import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, Matches, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from '../../dto/dtoDecorators';
import { Transform } from 'class-transformer';
import { toOptionalIdString, toNullableNumberStrict } from '../../dto/DtoTransforms';
import { SkipOnNullish } from '../../dto/dtoDecorators';
export class SaveTenderMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing tender',
  })
  @OptionalUuid()
  tndId?: string;
  @ApiProperty({ example: '1' })
  @Transform(({ value }) => toOptionalIdString(value))
  @Matches(/^\d+$/)
  tndTypeId!: string;
  @ApiProperty()
  @TrimmedString()
  @IsNotEmpty()
  tndName!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  tndLedgerId!: string;
  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndMinAmount!: number;
  @ApiPropertyOptional({ nullable: true, minimum: 0 })
  @IsOptional()
  @Transform(({ value }) => toNullableNumberStrict(value))
  @SkipOnNullish()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  tndMaxAmount?: number | null;
  @ApiPropertyOptional({ minimum: 0 })
  @OptionalInteger(0)
  tndDisplayPosition?: number;
  @ApiPropertyOptional({ minimum: 0 })
  @OptionalNumber(0)
  tndSurchargePerc?: number;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndIsActive?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  tndRemarks?: string | null;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndEditSurcharge?: boolean;
  @ApiPropertyOptional()
  @OptionalBoolean()
  tndEditLedger?: boolean;
}