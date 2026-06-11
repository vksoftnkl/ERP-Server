import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NullableNumber, RequiredUuid } from '../../../common/dto/dtoDecorators';

export class ColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'Column serial id to update' })
  @RequiredUuid()
  grid_serialid!: string;

  @ApiProperty({ nullable: true, type: Number })
  @NullableNumber()
  grid_column_width!: number | null;
}

export class SaveColumnWidthDto {
  @ApiProperty({ type: [ColumnWidthItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnWidthItemDto)
  columns!: ColumnWidthItemDto[];
}
