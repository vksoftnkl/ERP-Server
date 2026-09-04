import { Catch } from '@nestjs/common';
import { SettingsExceptionFilter } from 'src/common/utils/module-exception-filter.utils';
import {
  PrintTemplateAssignmentErrorDetail,
  PrintTemplateAssignmentErrorResponse,
} from './types/print-template-assignment-api.types';

@Catch()
export class PrintTemplateAssignmentExceptionFilter extends SettingsExceptionFilter<
  PrintTemplateAssignmentErrorDetail,
  PrintTemplateAssignmentErrorResponse
> {
  constructor() {
    super(/\b(pta[A-Za-z0-9]+)\b/);
  }
}
