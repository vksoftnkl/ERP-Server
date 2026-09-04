import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryInt, OptionalTrimmedString } from 'src/common/dto/dtoDecorators';
export abstract class PurchaseListQueryBaseDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @OptionalTrimmedString(200)
  search?: string;
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}