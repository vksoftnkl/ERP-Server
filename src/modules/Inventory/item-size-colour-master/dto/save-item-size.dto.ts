import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NullableString, NullableUuid, toTrimmedString } from 'src/common/dto/dtoDecorators';

export class SaveItemSizeDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, the request updates that size.',
  })
  @NullableUuid()
  isz_id?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = shared by every company. Taken on create; ignored on update.',
  })
  @NullableUuid()
  isz_company_id?: string | null;

  @ApiProperty({
    maxLength: 50,
    example: 'XL',
    description:
      'Trimmed. Unique ignoring case among the live sizes of the company and the shared ones: ' +
      'a taken name is a 409 ITEM_SIZE_NAME_TAKEN whose error carries existingId — a quick-add ' +
      'uses that row.',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  isz_name!: string;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  isz_code?: string | null;

  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    example: 'ALPHA',
    description: 'ALPHA / WAIST / KIDS / free text: groups sizes for a size grid.',
  })
  @NullableString(20)
  isz_size_set?: string | null;

  @ApiPropertyOptional({ default: 0, description: 'S < M < L < XL; lists and reports sort by it.' })
  @IsOptional()
  @IsInt()
  isz_sort?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isz_is_active?: boolean;
}
