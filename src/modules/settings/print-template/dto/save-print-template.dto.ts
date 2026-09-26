import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableInteger,
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import { PTL_CODE_MAX_LENGTH, PTL_NAME_MAX_LENGTH } from '../print-template.constants';
import { SavePrintTemplateVersionDto } from './save-print-template-version.dto';

/** A sane ceiling on how many revisions one call may touch. */
const MAX_VERSIONS_PER_REQUEST = 20;

/**
 * The whole design in one body: the template object, its `versions` array, and
 * each version's `datasets` array.
 *
 * WHY THE DATASETS NEST INSIDE A VERSION rather than sitting beside them at the
 * top level: ptd_version_id says so. A dataset is part of the report
 * definition, not a setting beside it — if it hung off the template, editing a
 * query would silently change what every past version rendered, and
 * print_log's version reference would be a lie.
 *
 * Send ptlId to update, omit it to create. On update only the keys actually
 * present are written, so a screen can rename a template without resending the
 * design.
 *
 * The two arrays do NOT behave the same way, and the difference is the schema's:
 *   versions   omitted = untouched, present = insert/update the rows in it.
 *              Rows MISSING from the array are LEFT ALONE, because the version
 *              history is append-only — ux_ptv_template_rev is not partial on
 *              is_deleted. Removing one is an explicit ptvIsDeleted: true.
 *   datasets   omitted = untouched, present = REPLACES that version's set,
 *              soft deleting the rows that are missing. Every ptd unique index
 *              IS partial on is_deleted, so this is safe and it is what the
 *              designer grid wants.
 */
export class SavePrintTemplateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update the existing template, absent = create one',
  })
  @OptionalUuid()
  ptlId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'NULL = shipped with the product, visible to every company. The only scope column here — ' +
      'branch, device and "is default" are RESOLUTION questions and live on the assignment.',
  })
  @NullableUuid()
  ptlCompanyId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'print_purpose.ppo_id — WHAT this design prints. Required on create.',
  })
  @OptionalUuid()
  ptlPurposeId?: string;

  @ApiPropertyOptional({
    maxLength: PTL_CODE_MAX_LENGTH,
    example: 'SALE_INVOICE_A4',
    description:
      'Letters, digits, underscore and hyphen. Unique per owner, case-insensitively — a shipped ' +
      "code and a company's own copy of it coexist, which is what forking means.",
  })
  @OptionalTrimmedString(PTL_CODE_MAX_LENGTH)
  ptlCode?: string;

  @ApiPropertyOptional({ maxLength: PTL_NAME_MAX_LENGTH, example: 'Tax Invoice — A4' })
  @OptionalTrimmedString(PTL_NAME_MAX_LENGTH)
  ptlName?: string;

  @ApiPropertyOptional({ nullable: true })
  @NullableString()
  ptlDescription?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      "The revision a render actually uses. Usually left alone: setting a version's ptvStatus " +
      'to PUBLISHED moves this pointer for you. Sent explicitly, it must name a PUBLISHED, ' +
      'undeleted version OF THIS TEMPLATE — a rule fk_ptl_published_rev does not itself enforce.',
  })
  @NullableUuid()
  ptlPublishedRevId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Where a clone came from. Goes with ptlForkedFromRev; neither works alone.',
  })
  @NullableUuid()
  ptlForkedFromId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  ptlForkedFromRev?: number | null;

  @ApiPropertyOptional({
    default: 100,
    minimum: 0,
    description: 'Order in the "print in format" list',
  })
  @OptionalInteger(0)
  ptlSortOrder?: number;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ptlIsActive?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptlCreatedBy?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptlModifiedBy?: string | null;

  @ApiPropertyOptional({
    type: [SavePrintTemplateVersionDto],
    description:
      'The revisions. Rows carrying ptvId update that revision — a DRAFT only — and rows ' +
      'without one are appended as the next revision. A revision MISSING from the array is left ' +
      'alone: the history is append-only, so deleting one is an explicit ptvIsDeleted: true.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_VERSIONS_PER_REQUEST)
  @ValidateNested({ each: true })
  @Type(() => SavePrintTemplateVersionDto)
  versions?: SavePrintTemplateVersionDto[];
}
