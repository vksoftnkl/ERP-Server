import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/** Notes 140 B — the scheduled row to cancel, an ipm_id from GET /stock/price-schedule. */
export class CancelPriceScheduleDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ipmId!: string;
}
