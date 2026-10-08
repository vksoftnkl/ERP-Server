import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';

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

export class PostDcReturnDto extends DcReturnKeysDto {}

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
