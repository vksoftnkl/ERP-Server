import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalUuid,
  TrimmedString,
} from '../../../sales/dto/dtoDecorators';

export class SaveBankListDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing bank row',
  })
  @OptionalUuid()
  bnkId?: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  bnkName!: string;

  @ApiPropertyOptional({ maxLength: 80, nullable: true })
  @NullableString(80)
  bnkShortName?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @NullableString(120)
  bnkAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableString(30)
  bnkRbiCode?: string | null;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  bnkIbanSupported?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  bnkIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  bnkCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  bnkModifiedBy?: string | null;
}
