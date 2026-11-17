import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveDcReturnDto } from './save-dc-return.dto';

export class DcReturnKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdrBranchId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  sdrAccYear!: string;
}

export class PostDcReturnDto extends DcReturnKeysDto {
  @ApiPropertyOptional({ description: 'The screen prints after the post (Ctrl+Enter). The server ignores it.' })
  @IsOptional()
  @IsBoolean()
  printAfter?: boolean;

  /**
   * P6 N5 (user 11-17): the WARN codes the user ticked to go on with (e.g.
   * SALES_BACKDATE under sales.backdate_mode WARN), as the challan's /post.
   * Honoured only for a user with the Override right on 251.
   */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];
}

/** §8.3 `POST /dc-returns/validate` (G3) — the create body, nothing written. */
export class ValidateDcReturnDto extends SaveDcReturnDto {}

/** §8.3 `GET /dc-returns/open-lines` (G7) — scoped to the company and branch. */
export class DcReturnOpenLinesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sdcId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  sdcAccYear!: string;
}

export class CancelDcReturnDto extends DcReturnKeysDto {
  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}

export class DcReturnTransportDto extends DcReturnKeysDto {
  @ApiProperty({ type: TransportBandDto })
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport!: TransportBandDto;
}
