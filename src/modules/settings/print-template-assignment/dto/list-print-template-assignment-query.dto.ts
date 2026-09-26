import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { NullableUuid, OptionalQueryBoolean } from 'src/common/dto/dtoDecorators';
import { ModuleListQueryBaseDto } from 'src/common/utils/module-list-query.base.dto';
import { PTA_OUTPUT_MODES } from '../print-template-assignment.constants';

export class ListPrintTemplateAssignmentQueryDto extends ModuleListQueryBaseDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Matches this company exactly. Pair with includeGlobal to see what it inherits.',
  })
  @NullableUuid()
  ptaCompanyId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'With ptaCompanyId: also return the every-company rows (pta_company_id IS NULL) that this company inherits where it has said nothing. Alone: no effect — the unfiltered list already contains them. Supports true/false/1/0/yes/no/on/off.',
  })
  @OptionalQueryBoolean()
  includeGlobal?: boolean;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Only the every-company rows (pta_company_id IS NULL). Supports true/false/1/0/yes/no/on/off.',
  })
  @OptionalQueryBoolean()
  globalOnly?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @NullableUuid()
  ptaBranchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @NullableUuid()
  ptaDeviceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @NullableUuid()
  ptaPurposeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @NullableUuid()
  ptaTemplateId?: string;

  @ApiPropertyOptional({ enum: PTA_OUTPUT_MODES })
  @IsOptional()
  @IsIn(PTA_OUTPUT_MODES)
  ptaOutputMode?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Supports true/false/1/0/yes/no/on/off' })
  @OptionalQueryBoolean()
  ptaIsActive?: boolean;
}
