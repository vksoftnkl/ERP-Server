import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
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
import { SaveSaleReturnDto } from './save-sale-return.dto';

export class SaleReturnKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srBranchId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  srAccYear!: string;
}

export class ValidateSaleReturnDto extends SaveSaleReturnDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];
}

export class PostSaleReturnDto extends SaleReturnKeysDto {
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

export class CancelSaleReturnDto extends SaleReturnKeysDto {
  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}

export class AmendSaleReturnDto extends ValidateSaleReturnDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  declare srId: string;

  @ApiProperty()
  @RequiredInteger(1)
  baseRevision!: number;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;
}

export class SaleReturnTransportDto extends SaleReturnKeysDto {
  @ApiProperty({ type: TransportBandDto })
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport!: TransportBandDto;
}
