import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';

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
  @ApiPropertyOptional({ example: '019e722d-ce2b-7a18-a6de-1f69e33eb048', description: 'When provided, updates per-user visibility (umVisibility) instead of global menu visibility.' })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ type: [MenuVisibilityItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuVisibilityItemDto)
  menus!: MenuVisibilityItemDto[];
}
