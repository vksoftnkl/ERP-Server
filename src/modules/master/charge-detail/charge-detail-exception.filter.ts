import { Catch } from '@nestjs/common';
import { ModuleExceptionFilter } from 'src/common/utils/module-shared.utils';
import {
  ChargeDetailErrorDetail,
  ChargeDetailErrorResponse,
} from './types/charge-detail-api.types';

@Catch()
export class ChargeDetailExceptionFilter extends ModuleExceptionFilter<
  ChargeDetailErrorDetail,
  ChargeDetailErrorResponse
> {
  constructor() {
    super(/\b(cd[A-Za-z0-9]+)\b/);
  }
}
