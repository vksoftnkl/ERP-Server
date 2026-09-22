import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  OptionalBoolean,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveDeliveryChallanDto } from './save-delivery-challan.dto';

export class DeliveryChallanKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcBranchId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  sdcAccYear!: string;
}

export class ValidateDeliveryChallanDto extends SaveDeliveryChallanDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];
}

export class PostDeliveryChallanDto extends DeliveryChallanKeysDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  printAfter?: boolean;
}

export class CancelDeliveryChallanDto extends DeliveryChallanKeysDto {
  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}

export class AmendDeliveryChallanDto extends ValidateDeliveryChallanDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  declare sdcId: string;

  @ApiProperty()
  @RequiredInteger(1)
  baseRevision!: number;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;
}

export const DC_PURPOSES = [
  'SUPPLY',
  'JOB_WORK',
  'APPROVAL',
  'EXHIBITION',
  'OWN_USE',
  'LINE_SALES',
  'OTHER',
] as const;

export class ConvertPurposeDto extends DeliveryChallanKeysDto {
  @ApiProperty({ enum: DC_PURPOSES })
  @IsIn(DC_PURPOSES)
  purpose!: (typeof DC_PURPOSES)[number];

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  remark!: string;
}

export class DeliveryChallanTransportDto extends DeliveryChallanKeysDto {
  @ApiProperty({ type: TransportBandDto })
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport!: TransportBandDto;
}
