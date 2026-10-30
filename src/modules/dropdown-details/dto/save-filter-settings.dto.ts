import { IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from '../../../common/dto/dtoDecorators';

export class FilterSettingItemDto {
  @ApiProperty({ type: String, description: 'Dropdown column id to update' })
  @RequiredUuid()
  dropdown_columns_id!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  dropdown_columns_filter!: boolean;
}

export class SaveFilterSettingsDto {
  @ApiProperty({ type: [FilterSettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterSettingItemDto)
  columns!: FilterSettingItemDto[];
}
