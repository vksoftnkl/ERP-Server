import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalNumberString,
  TrimmedString,
} from '../../../sales/dto/dtoDecorators';

export class SaveUiTableMasterDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates the existing UI table row',
    example: '1',
  })
  @OptionalNumberString()
  uiTblId?: string;

  @ApiProperty({ description: 'UI table name', example: 'Item Master Grid' })
  @TrimmedString(500)
  @IsNotEmpty()
  uiTblName!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  uiTblEditable?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  uiTblIsActive?: boolean;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  uiTblCreatedBy?: string | null;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableString(100)
  uiTblModifiedBy?: string | null;
}
