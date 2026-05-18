import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import { ItemCategoryErrorDetail, ItemCategoryErrorResponse } from './types/item-category-api.types';

@Catch()
export class ItemCategoryExceptionFilter extends InventoryExceptionFilter<ItemCategoryErrorDetail, ItemCategoryErrorResponse> {
  constructor() { super(/\b(category_[a-z0-9_]+)\b/i); }
}
