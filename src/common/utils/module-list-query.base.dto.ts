import { ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryInt, OptionalTrimmedString } from '../dto/dtoDecorators';
export abstract class ModuleListQueryBaseDto {
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
export {
  ModuleListQueryBaseDto as AccountsListQueryBaseDto,
  ModuleListQueryBaseDto as FixedListQueryBaseDto,
  ModuleListQueryBaseDto as InventoryListQueryBaseDto,
  ModuleListQueryBaseDto as PurchaseListQueryBaseDto,
  ModuleListQueryBaseDto as SalesListQueryBaseDto,
};