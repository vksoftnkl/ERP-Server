import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/** GET /transporters/get?trnId= and POST /transporters/delete { trnId }. */
export class TransporterRefDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  trnId!: string;
}
