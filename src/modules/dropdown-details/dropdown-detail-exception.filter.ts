import { Catch } from '@nestjs/common';
import { FixedExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  DropdownDetailErrorDetail,
  DropdownDetailErrorResponse,
} from './types/dropdown-detail-api.types';

@Catch()
export class DropdownDetailExceptionFilter extends FixedExceptionFilter<
  DropdownDetailErrorDetail,
  DropdownDetailErrorResponse
> {
  constructor() {
    super(/\b(dropdown_[a-z0-9_]+)\b/i);
  }
}
