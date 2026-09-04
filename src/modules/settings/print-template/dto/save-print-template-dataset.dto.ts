import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  NullableInteger,
  NullableLowerMaxString,
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalUuid,
  NullableUuid,
} from 'src/common/dto/dtoDecorators';
import {
  PTD_DATASET_NO_MAX,
  PTD_DATASET_NO_MIN,
  PTD_LABEL_MAX_LENGTH,
  PTD_NAME_MAX_LENGTH,
  PTD_PROVIDER_MAX_LENGTH,
  PTD_REMARKS_MAX_LENGTH,
  PTD_ROLES,
  PTD_ROW_LIMIT_MAX,
  PTD_ROW_LIMIT_MIN,
  PTD_SOURCE_KINDS,
  PTD_TIMEOUT_MS_MAX,
  PTD_TIMEOUT_MS_MIN,
  PTD_LINK_FIELDS_MAX_LENGTH,
} from '../print-template.constants';

/**
 * One row of a version's `datasets` array — §4, where the rows come from.
 *
 * Every field is optional HERE and required in the SERVICE, which is not
 * sloppiness: a dataset is nested two arrays deep, and class-validator can only
 * say "ptdName should not be empty". The service knows it is row 2 of version 1
 * and says so. The vocabularies below are the exception — an @IsIn message
 * carries its own list, so it is worth having early.
 *
 * ptdSqlNorm is absent by design: it is GENERATED ALWAYS, writing it raises
 * 428C9, and it comes back on every read.
 */
export class SavePrintTemplateDatasetDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update this dataset row, absent = insert a new one',
  })
  @OptionalUuid()
  ptdId?: string;

  @ApiPropertyOptional({
    enum: PTD_ROLES,
    default: 'DETAIL',
    description:
      'MASTER: the header context, one row read, and it must be ptdDatasetNo 0. ' +
      'DETAIL: a repeating band.',
  })
  @IsOptional()
  @IsIn(PTD_ROLES)
  ptdRole?: string;

  @ApiPropertyOptional({
    minimum: PTD_DATASET_NO_MIN,
    maximum: PTD_DATASET_NO_MAX,
    description:
      'THE BINDING — what a band actually points at, unique within the version. The MASTER is ' +
      'always 0. Changing it rebinds every band that names it.',
  })
  @OptionalInteger(PTD_DATASET_NO_MIN, PTD_DATASET_NO_MAX)
  ptdDatasetNo?: number;

  @ApiPropertyOptional({
    default: 0,
    description: 'Display order in the designer. Binds nothing — safe to reorder.',
  })
  @OptionalInteger()
  ptdSortOrder?: number;

  @ApiPropertyOptional({
    maxLength: PTD_NAME_MAX_LENGTH,
    example: 'items',
    description: 'The same binding by name. Lower snake case, starting with a letter.',
  })
  @NullableLowerMaxString(PTD_NAME_MAX_LENGTH)
  ptdName?: string;

  @ApiPropertyOptional({ maxLength: PTD_LABEL_MAX_LENGTH, nullable: true })
  @NullableString(PTD_LABEL_MAX_LENGTH)
  ptdLabel?: string | null;

  @ApiPropertyOptional({
    enum: PTD_SOURCE_KINDS,
    default: 'PROVIDER',
    description:
      'PROVIDER for anything needing joins across partitioned tables or real business logic; ' +
      'SQL for everything else, so a new report costs no release. Exactly one of ' +
      'ptdProviderCode / ptdSql goes with it.',
  })
  @IsOptional()
  @IsIn(PTD_SOURCE_KINDS)
  ptdSourceKind?: string;

  @ApiPropertyOptional({
    maxLength: PTD_PROVIDER_MAX_LENGTH,
    nullable: true,
    example: 'sales.bill.tax_summary',
    description: 'Required when ptdSourceKind is PROVIDER, and forbidden otherwise',
  })
  @NullableLowerMaxString(PTD_PROVIDER_MAX_LENGTH)
  ptdProviderCode?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example:
      'SELECT sbi_item_name AS item_name, sbi_qty AS qty FROM sales.sale_bill_items ' +
      'WHERE sbi_comp_id = :company_id AND sbi_sb_id = :doc_id ORDER BY sbi_slno',
    description:
      'Required when ptdSourceKind is SQL, and forbidden otherwise. Parameters are BOUND — ' +
      "write :company_id, never ':company_id'. Eleven authoring guards run on it; they are a " +
      'lint, not the security boundary.',
  })
  @NullableString()
  ptdSql?: string | null;

  @ApiPropertyOptional({
    default: true,
    description:
      'false only for genuinely global data, such as a state-code list. Leaving it true is what ' +
      "stops one company seeing another's numbers.",
  })
  @OptionalBoolean()
  ptdRequiresCompany?: boolean;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "Nested detail: this dataset's rows are the children of the current row of the dataset " +
      'with this number. Goes with ptdLinkFields; neither works alone.',
  })
  @NullableInteger()
  ptdParentNo?: number | null;

  @ApiPropertyOptional({
    maxLength: PTD_LINK_FIELDS_MAX_LENGTH,
    nullable: true,
    example: 'sb_id=bill_id,sbi_slno=slno',
    description:
      'parent=child pairs, comma separated, no spaces. LEFT is a column the PARENT dataset ' +
      'returns, RIGHT is one THIS dataset returns — both output columns, neither a parameter.',
  })
  @NullableLowerMaxString(PTD_LINK_FIELDS_MAX_LENGTH)
  ptdLinkFields?: string | null;

  @ApiPropertyOptional({
    minimum: PTD_ROW_LIMIT_MIN,
    maximum: PTD_ROW_LIMIT_MAX,
    default: 5000,
    description: 'Measures the WHOLE band — a child query runs once per render, not per parent row',
  })
  @OptionalInteger(PTD_ROW_LIMIT_MIN, PTD_ROW_LIMIT_MAX)
  ptdRowLimit?: number;

  @ApiPropertyOptional({
    minimum: PTD_TIMEOUT_MS_MIN,
    maximum: PTD_TIMEOUT_MS_MAX,
    default: 15000,
  })
  @OptionalInteger(PTD_TIMEOUT_MS_MIN, PTD_TIMEOUT_MS_MAX)
  ptdTimeoutMs?: number;

  @ApiPropertyOptional({ maxLength: PTD_REMARKS_MAX_LENGTH, nullable: true })
  @NullableString(PTD_REMARKS_MAX_LENGTH)
  ptdRemarks?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptdCreatedBy?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptdModifiedBy?: string | null;
}
