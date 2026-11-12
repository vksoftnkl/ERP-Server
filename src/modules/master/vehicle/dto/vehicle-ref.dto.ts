import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/** GET /vehicles/get?vehId= and POST /vehicles/delete { vehId }. */
export class VehicleRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  vehId!: string;
}
