import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { OptionalUpperMaxString, OptionalUuid } from 'src/common/dto/dtoDecorators';
import { CHARGE_MODULES } from '../types/charge-master-api.types';
// Exactly one of the two is expected; which one was sent decides whether the
// endpoint answers with a single charge or a module-filtered list. The
// "one and only one" rule is enforced in the service, not here, so the failure
// comes back in the module's error-detail shape.
export class GetChargeMasterQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: 'Fetch a single charge by id' })
  @OptionalUuid()
  chgId?: string;
  @ApiPropertyOptional({
    enum: CHARGE_MODULES,
    description:
      'Fetch every active charge for a module. P also returns B (both) charges, S also returns B, B returns B only.',
  })
  @OptionalUpperMaxString(1)
  @IsIn(CHARGE_MODULES)
  chgModule?: string;
}