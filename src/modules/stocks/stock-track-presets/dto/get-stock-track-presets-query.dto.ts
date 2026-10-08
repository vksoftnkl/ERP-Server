import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalTrimmedString, OptionalUuid } from 'src/common/dto/dtoDecorators';
export class GetStockTrackPresetsQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Company whose presets to merge with the shared ones. Defaults to the request context company. A company preset overrides a shared one of the same code.',
  })
  @OptionalUuid()
  company_id?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Fetch one preset by id. Returns it whether shared or company-owned.',
  })
  @OptionalUuid()
  spt_id?: string;
  @ApiPropertyOptional({
    description: 'Filter to a single code, after the company merge is applied.',
    example: 'PHARMA',
  })
  @OptionalTrimmedString(30)
  spt_code?: string;
}
