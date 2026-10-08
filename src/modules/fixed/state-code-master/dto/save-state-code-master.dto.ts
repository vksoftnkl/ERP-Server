import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  NullableUpperString,
  OptionalBoolean,
  TrimmedString,
  UpperString,
} from 'src/common/dto/dtoDecorators';

export class SaveStateCodeMasterDto {
  @ApiProperty({ minLength: 2, maxLength: 2, description: '2-character state code' })
  @UpperString(2)
  @IsNotEmpty()
  stateCode!: string;

  @ApiProperty({ maxLength: 100 })
  @TrimmedString(100)
  @IsNotEmpty()
  stateName!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  stateUt?: boolean;

  @ApiPropertyOptional({ minLength: 2, maxLength: 2, nullable: true })
  @NullableUpperString(2)
  tinCode?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  createdBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  modifiedBy?: string | null;
}
