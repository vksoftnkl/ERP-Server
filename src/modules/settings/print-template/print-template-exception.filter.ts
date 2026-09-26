import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  PrintTemplateErrorDetail,
  PrintTemplateErrorResponse,
} from './types/print-template-api.types';

/**
 * The field-name sniffer has to cover all three prefixes, because one payload
 * carries all three tables: ptl on the header, ptv on a version, ptd on a
 * dataset. It only fires on class-validator messages — everything the service
 * raises already names its own field, and with a path into the arrays.
 */
@Catch()
export class PrintTemplateExceptionFilter extends SettingsExceptionFilter<
  PrintTemplateErrorDetail,
  PrintTemplateErrorResponse
> {
  constructor() {
    super(/\b(pt[ldv][A-Za-z0-9]+)\b/);
  }
}
