import { IsArray, IsBoolean, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VisibilitySettingItemDto {
  @ApiProperty({ type: String, description: 'Column serial id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : value))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  grid_serialid!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  grid_column_visibility!: boolean;
}

export class SaveVisibilitySettingsDto {
  @ApiProperty({ type: [VisibilitySettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilitySettingItemDto)
  columns!: VisibilitySettingItemDto[];
}
