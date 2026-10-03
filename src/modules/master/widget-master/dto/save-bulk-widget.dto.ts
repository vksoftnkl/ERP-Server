import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { SaveWidgetDto } from './save-widget.dto';

/**
 * Bulk upsert: a non-empty array of sections (each with its nested fields).
 * Every section follows the same create/update rules as the single-section save and the
 * whole batch is persisted in one transaction (all-or-nothing).
 */
export class SaveBulkWidgetDto {
  @ApiProperty({ type: SaveWidgetDto, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SaveWidgetDto)
  data!: SaveWidgetDto[];
}
