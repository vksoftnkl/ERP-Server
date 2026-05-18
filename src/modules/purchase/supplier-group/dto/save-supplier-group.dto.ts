import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalUuid,
  TrimmedString,
} from '../../dto/dtoDecorators';

export class SaveSupplierGroupDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing supplier group',
  })
  @OptionalUuid()
  spgId?: string;

  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  spgName!: string;

  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  @NullableString(150)
  spgAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableString(50)
  spgShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  spgDesc?: string | null;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  spgIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  spgCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  spgModifiedBy?: string | null;
}
