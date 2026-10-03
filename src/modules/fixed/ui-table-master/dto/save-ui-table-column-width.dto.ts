import { IsArray, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableNumber, NullableString } from '../../../../common/dto/dtoDecorators';

export class UiTableColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'UI table column id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : (value as unknown)))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  uiTblClmId!: string;

  /**
   * The legacy Qt fraction. Optional, and normally not sent at all: the browser
   * sizes its grids from `uiTblClmPx` and has no business restating the desktop
   * client's sizing. Omitted leaves whatever is stored untouched.
   */
  @ApiPropertyOptional({ nullable: true, type: Number })
  @NullableNumber()
  uiTblClmColumnWidth?: number | null;

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
