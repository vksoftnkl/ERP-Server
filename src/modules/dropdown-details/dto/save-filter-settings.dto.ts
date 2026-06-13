import { IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from '../../../common/dto/dtoDecorators';

export class FilterSettingItemDto {
  @ApiProperty({ type: String, description: 'Dropdown column id to update' })
  @RequiredUuid()
  drop_columns_id!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  drop_columns_column_filter!: boolean;
}

export class SaveFilterSettingsDto {
  @ApiProperty({ type: [FilterSettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterSettingItemDto)
  columns!: FilterSettingItemDto[];
}
