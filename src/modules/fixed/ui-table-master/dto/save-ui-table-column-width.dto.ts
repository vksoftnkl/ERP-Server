import { IsArray, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableNumber, NullableString } from '../../../../common/dto/dtoDecorators';

export class UiTableColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'UI table column id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : value))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  uiTblClmId!: string;

  @ApiProperty({ nullable: true, type: Number })
  @NullableNumber()
  uiTblClmColumnWidth!: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String, example: '120px' })
  @NullableString(100)
  uiTblClmPx?: string | null;
}

export class SaveUiTableColumnWidthDto {
  @ApiProperty({ type: [UiTableColumnWidthItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UiTableColumnWidthItemDto)
  columns!: UiTableColumnWidthItemDto[];
}
