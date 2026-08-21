import { IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableString,
  NullableUuid,
  OptionalInteger,
  OptionalUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
export class SaveAccGroupMasterDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, request updates the existing account group',
  })
  @OptionalUuid()
  accGroupId?: string;

  @ApiProperty({ maxLength: 150 })
  @TrimmedString(150)
  @IsNotEmpty()
  accGroupName!: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @NullableString(100)
  accGroupAlias?: string | null;

  @ApiPropertyOptional({ maxLength: 50 })
  @NullableString(50)
  accGroupShort?: string | null;

  @ApiPropertyOptional({ maxLength: 250 })
  @NullableString(250)
  accGroupDescription?: string | null;
 
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  accGroupParentId?: string | null;

  @ApiPropertyOptional()
  @OptionalInteger()
  accGroupSort?: number;  
}
