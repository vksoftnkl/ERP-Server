import { IsArray, IsNotEmpty, IsNumberString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NullableNumber } from '../../../../common/dto/dtoDecorators';

export class UiTableColumnWidthItemDto {
  @ApiProperty({ type: String, description: 'UI table column id to update' })
  @Transform(({ value }) => (value != null ? String(value).trim() : value))
  @IsNotEmpty()
  @IsNumberString({ no_symbols: true })
  uiTblClmId!: string;

  @ApiProperty({ nullable: true, type: Number })
  @NullableNumber()
  uiTblClmColumnWidth!: number | null;
}

export class SaveUiTableColumnWidthDto {
  @ApiProperty({ type: [UiTableColumnWidthItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UiTableColumnWidthItemDto)
  columns!: UiTableColumnWidthItemDto[];
}
