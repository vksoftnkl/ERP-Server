import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NullableNumber, NullableString, RequiredUuid } from '../../../common/dto/dtoDecorators';

export class ColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'Column serial id to update' })
  @RequiredUuid()
  grid_column_id!: string;

  /**
   * The legacy Qt fraction. Optional, and normally not sent at all: the browser
   * sizes its grids from `grid_column_px` and has no business restating the
   * desktop client's sizing. Omitted leaves whatever is stored untouched.
   */
  @ApiPropertyOptional({ nullable: true, type: Number })
  @NullableNumber()
  grid_column_width?: number | null;

  /**
   * The width as the browser actually laid it out, e.g. `"180px"`.
   *
   * `grid_column_width` is the legacy Qt sizing — a fraction the client scales
   * back up — so a dragged column can only ever return to roughly where it was
   * left. This is the exact figure, and it is what the grid reopens at. Omitted
   * entirely by a caller that has no pixel width, which leaves whatever is
   * stored intact rather than clearing it.
   */
  @ApiPropertyOptional({ nullable: true, maxLength: 100, type: String, example: '180px' })
  @NullableString(100)
  grid_column_px?: string | null;
}

export class SaveColumnWidthDto {
  @ApiProperty({ type: [ColumnWidthItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnWidthItemDto)
  columns!: ColumnWidthItemDto[];
}
