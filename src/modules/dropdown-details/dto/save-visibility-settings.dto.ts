import { IsArray, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from '../../../common/dto/dtoDecorators';

export class VisibilitySettingItemDto {
  @ApiProperty({ type: String, description: 'Dropdown column id to update' })
  @RequiredUuid()
  dropdown_columns_id!: string;

  @ApiProperty({ type: Boolean })
  @IsBoolean()
  dropdown_columns_visiblity!: boolean;
}

export class SaveVisibilitySettingsDto {
  @ApiProperty({ type: [VisibilitySettingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VisibilitySettingItemDto)
  columns!: VisibilitySettingItemDto[];
}
