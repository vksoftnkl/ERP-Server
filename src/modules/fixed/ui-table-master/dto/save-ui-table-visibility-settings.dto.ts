import { IsArray, IsBoolean, IsNotEmpty, IsNumberString, IsOptional, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableInteger, NullableNumber, OptionalBoolean, OptionalInteger } from 'src/common/dto/dtoDecorators';

export class UiTableVisibilitySettingItemDto {
  @ApiProperty({ type: String, description: 'UI table column id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : value))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  uiTblClmId!: string;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 100 })
  @NullableNumber()
  uiTblClmColumnWidth?: number | null;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @IsOptional()
  @IsBoolean()
  uiTblClmColumnVisibility?: boolean;

  @ApiPropertyOptional({ type: Boolean, example: false })
  @OptionalBoolean()
  uiTblClmColumnFocus?: boolean;

  @ApiPropertyOptional({ type: Number, example: 0 })
  @OptionalInteger()
  uiTblClmColumnPosition?: number;

  @ApiPropertyOptional({ type: Boolean, example: false })
  @OptionalBoolean()
  uiTblClmColumnNecessity?: boolean;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2 })
  @NullableInteger()
  uiTblClmNextColumn?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: null })
  @NullableInteger()
  uiTblClmPreviousColumn?: number | null;
}

export class SaveUiTableVisibilitySettingsDto {
  @ApiProperty({ type: [UiTableVisibilitySettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UiTableVisibilitySettingItemDto)
  columns!: UiTableVisibilitySettingItemDto[];
}
