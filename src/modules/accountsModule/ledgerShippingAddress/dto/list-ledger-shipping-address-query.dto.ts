import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalQueryBoolean, OptionalQueryInt, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { toUpperTrimmed } from 'src/common/dto/DtoTransforms';
import { AccountsListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';

export class ListLedgerShippingAddressQueryDto extends AccountsListQueryBaseDto {
  @ApiPropertyOptional({ type: Number })
  @OptionalQueryInt()
  saaCompanyId?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  saaLedgerId?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @Transform(({ value }) => toUpperTrimmed(value))
  @IsString()
  @MaxLength(20)
  saaAddrType?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  saaIsActive?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  saaIsDefault?: boolean;
}
