import { Catch } from '@nestjs/common';
import { ModuleExceptionFilter, type ModuleErrorDetail, type ModuleErrorResponse } from 'src/common/utils/module-shared.utils';

/** /transporters/*: every refusal goes out with its plain words (notes 120). */
@Catch()
export class TransporterExceptionFilter extends ModuleExceptionFilter<ModuleErrorDetail, ModuleErrorResponse> {
  constructor() {
    super(/\b(trn[A-Za-z0-9]+)\b/);
  }
}
