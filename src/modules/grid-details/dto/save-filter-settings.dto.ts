import { IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from "../../../common/dto/dtoDecorators";

export class FilterSettingItemDto {
  @ApiProperty({ type: String, description: 'Column serial id to update' })
  @RequiredUuid()
  grid_serialid!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  grid_column_filter!: boolean;
}

export class SaveFilterSettingsDto {
  @ApiProperty({ type: [FilterSettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FilterSettingItemDto)
  columns!: FilterSettingItemDto[];
}
