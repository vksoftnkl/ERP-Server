import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsOptional, ValidateIf, ValidateNested } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalNumberString,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveUiTableColumnDto } from './save-ui-table-column.dto';

export class SaveUiTableMasterDto {
  @ApiPropertyOptional({
    description: 'When provided, request updates the existing UI table row',
    example: '1',
  })
  @OptionalNumberString()
  uiTblId?: string;

  @ApiProperty({ description: 'UI table name', example: 'Item Master Grid' })
  @TrimmedString(500)
  @ValidateIf((o) => !o.uiTblId)
  @IsNotEmpty()
  uiTblName!: string;

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  uiTblEditable?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  uiTblIsActive?: boolean;

  @ApiPropertyOptional({ description: 'Device type for this UI table', nullable: true })
  @NullableString(255)
  uiTblDeviceType?: string | null;

  @ApiPropertyOptional({
    description: 'Array of columns to create or update for this table',
    type: [SaveUiTableColumnDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveUiTableColumnDto)
  uiTblColumns?: SaveUiTableColumnDto[];

  @ApiPropertyOptional({
    description:
      'When true, columns not present in uiTblColumns are soft deleted (full replace). When false or omitted, provided columns are only created/updated.',
    default: false,
  })
  @OptionalBoolean()
  replaceColumns?: boolean;
}
