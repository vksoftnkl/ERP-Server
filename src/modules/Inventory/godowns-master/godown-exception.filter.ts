import { Catch } from '@nestjs/common';
import { InventoryExceptionFilter } from '../utils/inventory-exception-filter.utils';
import { GodownErrorDetail, GodownErrorResponse } from './types/godown-api.types';

@Catch()
export class GodownExceptionFilter extends InventoryExceptionFilter<GodownErrorDetail, GodownErrorResponse> {
  constructor() { super(/\b((?:gdl|godown)_[a-z0-9_]+)\b/i); }
}
