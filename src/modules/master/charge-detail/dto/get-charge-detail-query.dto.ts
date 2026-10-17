import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import { ChargeDocType } from '../types/charge-detail-api.types';
// Either cdId (one charge line) or the cdDocType + cdDocId pair (every charge
// line on that document). The "one lookup, not both" rule is enforced in the
// service so the failure comes back in the module's error-detail shape.
export class GetChargeDetailQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Fetch a single charge line by id' })
  @OptionalUuid()
  cdId?: string;
  @ApiPropertyOptional({
    enum: ChargeDocType,
    enumName: 'ChargeDocType',
    description: "Parent document's module; send together with cdDocId",
  })
  @OptionalUpperMaxString(12)
  @IsEnum(ChargeDocType)
  cdDocType?: ChargeDocType;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Parent document id; send together with cdDocType',
  })
  @OptionalUuid()
  cdDocId?: string;
  @ApiPropertyOptional({
    description: 'Document lookup only: restrict to cd_is_active = true rows. Defaults to all',
  })
  @OptionalQueryBoolean()
  isActive?: boolean;
}
