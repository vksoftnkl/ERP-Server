import { IsArray, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NullableNumber } from '../../../common/dto/dtoDecorators';

export class ColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'Column serial id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : value))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
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
