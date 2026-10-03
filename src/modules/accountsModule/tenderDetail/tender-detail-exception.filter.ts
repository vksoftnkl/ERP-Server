import { Catch } from '@nestjs/common';
import { ModuleExceptionFilter } from 'src/common/utils/module-shared.utils';
import {
  TenderDetailErrorDetail,
  TenderDetailErrorResponse,
} from './types/tender-detail-api.types';

@Catch()
export class TenderDetailExceptionFilter extends ModuleExceptionFilter<
  TenderDetailErrorDetail,
  TenderDetailErrorResponse
> {
  constructor() {
    super(/\b(td[A-Za-z0-9]+)\b/);
  }
}
