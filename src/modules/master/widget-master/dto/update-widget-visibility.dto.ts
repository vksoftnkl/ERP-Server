import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { toOptionalInteger, toTrimmedString } from 'src/common/dto/dto-transforms';

/** One field whose visibility / secondary text is being updated. */
export class UpdateWidgetVisibilityFieldDto {
  @ApiProperty({ example: 1, minimum: 1, description: 'Field to update' })
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  fieldId!: number;

  @ApiProperty({ maxLength: 255, example: 'Secondary text' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @MaxLength(255)
  fieldSecondaryText!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  fieldVisibility!: boolean;
}

/** One section whose visibility / gui name is being updated, together with its fields. */
export class UpdateWidgetVisibilitySectionDto {
  @ApiProperty({ example: 1, minimum: 1, description: 'Section to update' })
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  sectionId!: number;

  @ApiProperty({ maxLength: 255, example: 'Primary Information' })
  @Transform(({ value }) => toTrimmedString(value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  sectionGuiName!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  sectionVisibility!: boolean;

  @ApiProperty({ type: UpdateWidgetVisibilityFieldDto, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateWidgetVisibilityFieldDto)
  fields!: UpdateWidgetVisibilityFieldDto[];
}

/** Bulk visibility update: a non-empty array of sections, each with its fields. */
export class UpdateWidgetVisibilityDto {
  @ApiProperty({ type: UpdateWidgetVisibilitySectionDto, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => UpdateWidgetVisibilitySectionDto)
  data!: UpdateWidgetVisibilitySectionDto[];
}
