import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePriceLevelItemDto {
  @ApiProperty({
    description: 'Price level ID to update',
    minimum: 1,
    example: 1,
  })
  @IsNumber()
  priceLvlId!: number;

  @ApiPropertyOptional({
    description: 'Price level name',
    minLength: 1,
    maxLength: 200,
    example: 'Retail',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  priceLvlName?: string;

  @ApiPropertyOptional({
    description: 'Price level short code',
    maxLength: 50,
    nullable: true,
    example: 'RTL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  priceLvlShort?: string | null;

  @ApiPropertyOptional({
    description: 'Whether the price level is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  priceLvlIsActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the price level is admin',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  priceLvlIsAdmin?: boolean;
}

export class UpdatePriceLevelMasterDto {
  @ApiProperty({
    description: 'Array of price levels to update',
    type: UpdatePriceLevelItemDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePriceLevelItemDto)
  priceLevels!: UpdatePriceLevelItemDto[];
}
