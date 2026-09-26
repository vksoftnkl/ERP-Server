import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { NullableUuid, OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { PTV_ENGINES } from '../print-template.constants';

/**
 * GET /list — the "print in format" list, ordered the way ix_ptl_purpose is:
 * purpose, then owner, then sort order.
 *
 * Every filter is an optional narrowing. A bare /list is every live template
 * there is, shipped designs included.
 */
export class ListPrintTemplateQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Narrow to one company. See onlyOwned for what happens to the shipped designs, which ' +
      'belong to no company and are visible to all of them.',
  })
  @NullableUuid()
  ptlCompanyId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      "With ptlCompanyId: false (the default) returns that company's templates AND the shipped " +
      "ones it can use; true returns only the company's own. Ignored without ptlCompanyId.",
  })
  @OptionalQueryBoolean()
  onlyOwned?: boolean;

  @ApiPropertyOptional({ format: 'uuid', description: 'print_purpose.ppo_id' })
  @NullableUuid()
  ptlPurposeId?: string;

  @ApiPropertyOptional({
    enum: PTV_ENGINES,
    description: 'Only templates whose PUBLISHED revision uses this engine',
  })
  @IsOptional()
  @IsIn(PTV_ENGINES)
  engine?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Only templates that have a published revision (true), or only those that do not',
  })
  @OptionalQueryBoolean()
  isPublished?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ptlIsActive?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'Return each template WHOLE, with its versions and their datasets — the same shape ' +
      '/get answers with. Set false for a light pick list: header rows only.',
  })
  @OptionalQueryBoolean()
  includeVersions?: boolean;
}
