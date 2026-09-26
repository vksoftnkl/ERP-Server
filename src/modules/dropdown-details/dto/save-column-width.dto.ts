import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NullableNumber, RequiredUuid } from '../../../common/dto/dtoDecorators';

export class ColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'Dropdown column id to update' })
  @RequiredUuid()
  dropdown_columns_id!: string;

  @ApiProperty({ nullable: true, type: Number })
  @NullableNumber()
  dropdown_columns_width!: number | null;
}

export class SaveColumnWidthDto {
  @ApiProperty({ type: [ColumnWidthItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnWidthItemDto)
  columns!: ColumnWidthItemDto[];
}
