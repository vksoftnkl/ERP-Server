import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NullableString, NullableUuid, toTrimmedString } from 'src/common/dto/dtoDecorators';

export class SaveItemColourDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, the request updates that colour.',
  })
  @NullableUuid()
  icl_id?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'NULL = shared by every company. Taken on create; ignored on update.',
  })
  @NullableUuid()
  icl_company_id?: string | null;

  @ApiProperty({
    maxLength: 50,
    example: 'Maroon',
    description:
      'Trimmed. Unique ignoring case among the live colours of the company and the shared ones: ' +
      'a taken name is a 409 ITEM_COLOUR_NAME_TAKEN whose error carries existingId — a ' +
      'quick-add uses that row.',
  })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  icl_name!: string;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableString(20)
  icl_code?: string | null;

  @ApiPropertyOptional({ default: 0, description: 'Lists sort by it, then by name.' })
  @IsOptional()
  @IsInt()
  icl_sort?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  icl_is_active?: boolean;
}
