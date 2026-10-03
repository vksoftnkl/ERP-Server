import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetPlatform } from '../types/widget-master-api.types';

export class WidgetMasterErrorFieldDto {
  @ApiProperty({ example: 'sectionId' })
  field!: string;

  @ApiProperty({ example: 'sectionId must be a positive integer' })
  message!: string;
}

export class WidgetMasterErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: WidgetMasterErrorFieldDto, isArray: true })
  errors!: WidgetMasterErrorFieldDto[];
}

export class WidgetFieldPayloadDto {
  @ApiProperty({ example: 1 })
  fieldId!: number;

  @ApiProperty({ example: 10 })
  fieldSectionId!: number;

  @ApiProperty({ example: 'item_name' })
  fieldName!: string;

  @ApiPropertyOptional({ nullable: true, example: 'English Name' })
  fieldGuiName!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Secondary text' })
  fieldSecondaryText!: string | null;

  @ApiProperty({ example: 0 })
  fieldPosition!: number;

  @ApiProperty({ example: true })
  fieldVisibility!: boolean;
}

export class WidgetMasterPayloadDto {
  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: 10, description: 'Menu/screen this section belongs to' })
  sectionMenuId!: number;

  @ApiProperty({ example: 'Primary Information' })
  sectionName!: string;

  @ApiProperty({ example: 'Primary Information' })
  sectionGuiName!: string;

  @ApiProperty({ example: 0 })
  sectionPosition!: number;

  @ApiProperty({ example: true })
  sectionVisibility!: boolean;

  @ApiProperty({ enum: WidgetPlatform, enumName: 'WidgetPlatform' })
  sectionPlatform!: WidgetPlatform;
  @ApiProperty({ type: WidgetFieldPayloadDto, isArray: true })
  fields!: WidgetFieldPayloadDto[];
}

export class WidgetMasterDeleteResultDto {
  @ApiProperty({ example: 1 })
  sectionId!: number;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class WidgetMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Widget section fetched successfully' })
  message!: string;

  @ApiProperty({ type: WidgetMasterPayloadDto })
  data!: WidgetMasterPayloadDto;
}

export class WidgetMasterSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Widgets fetched successfully' })
  message!: string;

  @ApiProperty({ type: WidgetMasterPayloadDto, isArray: true })
  data!: WidgetMasterPayloadDto[];
}

export class WidgetMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Widget section deleted successfully' })
  message!: string;

  @ApiProperty({ type: WidgetMasterDeleteResultDto })
  data!: WidgetMasterDeleteResultDto;
}
