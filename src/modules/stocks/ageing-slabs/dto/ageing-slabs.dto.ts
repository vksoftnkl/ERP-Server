import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, ValidateNested } from 'class-validator';
import {
  NullableInteger,
  RequiredInteger,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

/** GET /stock/ageing-slabs and POST /stock/ageing-slabs/revert. */
export class AgeingSlabsCompanyDto {
  @ApiProperty({ format: 'uuid', description: 'The company whose ladder is read or reverted.' })
  @RequiredUuid()
  companyId!: string;
}

/**
 * One rung of the ladder, as the screen sends it. Only the TYPES are checked
 * here: every range and ladder rule is the service's, so it comes back as a
 * 422 naming `slabs.<i>.<field>`, not as a 400 from the pipe.
 */
export class AgeingSlabDto {
  @ApiProperty({ minimum: 1, maximum: 20, example: 1, description: '1..n, in order.' })
  @RequiredInteger()
  slabNo!: number;

  @ApiProperty({ maxLength: 50, example: '0-30 days', description: 'Non-blank, unique within the ladder (any case).' })
  @TrimmedString(50)
  label!: string;

  @ApiProperty({
    minimum: 0,
    example: 0,
    description: 'The first slab starts at 0; each next one the day after the previous one ends.',
  })
  @RequiredInteger()
  fromDays!: number;

  @ApiPropertyOptional({
    minimum: 0,
    nullable: true,
    example: 30,
    description: 'Inclusive. null = open-ended ("and older"): exactly one slab is, and it is the last.',
  })
  @NullableInteger()
  toDays?: number | null;
}

/**
 * POST /stock/ageing-slabs/save — the WHOLE ladder, never a row. Every company
 * row is replaced in one transaction; "Customise" on the screen is this save
 * sent with a copy of the shared default.
 */
export class SaveAgeingSlabsDto extends AgeingSlabsCompanyDto {
  @ApiProperty({
    type: AgeingSlabDto,
    isArray: true,
    description:
      '1–20 slabs, slabNo 1..n, contiguous from day 0, the last (only the last) open-ended. Refused 422 per field (slabs.<i>.fromDays …) otherwise.',
  })
  @IsArray()
  // A guard against a runaway body only: the 1–20 rule is the service's 422.
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AgeingSlabDto)
  slabs!: AgeingSlabDto[];
}
