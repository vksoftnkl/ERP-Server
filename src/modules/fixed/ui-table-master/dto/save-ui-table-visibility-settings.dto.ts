import { IsArray, IsBoolean, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UiTableVisibilitySettingItemDto {
  @ApiProperty({ type: String, description: 'UI table column id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : value))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  uiTblClmId!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  uiTblClmColumnVisibility!: boolean;
}

export class SaveUiTableVisibilitySettingsDto {
  @ApiProperty({ type: [UiTableVisibilitySettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UiTableVisibilitySettingItemDto)
  columns!: UiTableVisibilitySettingItemDto[];
}
