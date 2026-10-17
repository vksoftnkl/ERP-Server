import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, Min, ValidateNested } from 'class-validator';

export class MenuVisibilityItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  menuId!: number;

  @ApiProperty({ example: true })
  @IsBoolean()
  menuVisibility!: boolean;
}

export class UpdateMenuVisibilityDto {
  @ApiProperty({ type: [MenuVisibilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuVisibilityItemDto)
  menus!: MenuVisibilityItemDto[];
}
