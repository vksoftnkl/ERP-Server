import { IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from "../../../common/dto/dtoDecorators";

export class VisibilitySettingItemDto {
  @ApiProperty({ type: String, description: 'Column serial id to update' })
  @RequiredUuid()
  grid_column_id!: string;

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
