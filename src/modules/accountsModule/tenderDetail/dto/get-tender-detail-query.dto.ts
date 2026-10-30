import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OptionalUpperMaxString, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { TenderSrcDocType, TenderSrcModule } from '../types/tender-detail-api.types';
// Either tdId (one tender line) or the tdSrcModule + tdSrcDocType + tdSrcDocId
// triple (every tender line on that document). The "one lookup, not both" rule
// is enforced in the service so the failure comes back in the module's
// error-detail shape.
export class GetTenderDetailQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Fetch a single tender line by id' })
  @OptionalUuid()
  tdId?: string;
  @ApiPropertyOptional({
    enum: TenderSrcModule,
    enumName: 'TenderSrcModule',
    description: 'Parent document module; send together with tdSrcDocType and tdSrcDocId',
  })
  @OptionalUpperMaxString(20)
  @IsEnum(TenderSrcModule)
  tdSrcModule?: TenderSrcModule;
  @ApiPropertyOptional({
    enum: TenderSrcDocType,
    enumName: 'TenderSrcDocType',
    description: 'Parent document kind; send together with tdSrcModule and tdSrcDocId',
  })
  @OptionalUpperMaxString(30)
  @IsEnum(TenderSrcDocType)
  tdSrcDocType?: TenderSrcDocType;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Parent document id; send together with tdSrcModule and tdSrcDocType',
  })
  @OptionalUuid()
  tdSrcDocId?: string;
}
