import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WidgetPlatform } from '@prisma/client';

export class WidgetMasterErrorFieldDto {
  @ApiProperty({ example: 'widgetNo' })
  field!: string;

  @ApiProperty({ example: 'widgetNo must be a positive integer' })
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

export class WidgetMasterPayloadDto {
  @ApiProperty({ example: 1 })
  widgetNo!: number;

  @ApiProperty({ example: 10 })
  widgetGroupId!: number;

  @ApiProperty({ example: 'Daily Sales' })
  widgetName!: string;

  @ApiProperty({ example: 0 })
  widgetPosition!: number;

  @ApiProperty({ example: true })
  widgetVisibility!: boolean;

  @ApiPropertyOptional({ nullable: true, example: 'sales-daily-widget' })
  widgetGuiName!: string | null;

  @ApiProperty({ enum: WidgetPlatform, enumName: 'WidgetPlatform' })
  widgetType!: WidgetPlatform;

  @ApiPropertyOptional({ nullable: true, example: 'Updated 5 minutes ago' })
  widgetSecondaryText!: string | null;
}

export class WidgetMasterListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 3 })
  total!: number;

  @ApiProperty({ example: 1 })
  total_pages!: number;
}

export class WidgetMasterDeleteResultDto {
  @ApiProperty({ example: 1 })
  widgetNo!: number;

  @ApiProperty({ example: true })
  deleted!: true;
}

export class WidgetMasterSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Widget fetched successfully' })
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

  @ApiProperty({ type: WidgetMasterListMetaDto })
  meta!: WidgetMasterListMetaDto;
}

export class WidgetMasterSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Widget deleted successfully' })
  message!: string;

  @ApiProperty({ type: WidgetMasterDeleteResultDto })
  data!: WidgetMasterDeleteResultDto;
}
