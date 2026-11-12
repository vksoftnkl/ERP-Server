import { Catch } from '@nestjs/common';
import { ModuleExceptionFilter, type ModuleErrorDetail, type ModuleErrorResponse } from 'src/common/utils/module-shared.utils';

/** /vehicles/*: every refusal goes out with its plain words (notes 120). */
@Catch()
export class VehicleExceptionFilter extends ModuleExceptionFilter<ModuleErrorDetail, ModuleErrorResponse> {
  constructor() {
    super(/\b(veh[A-Za-z0-9]+)\b/);
  }
}
