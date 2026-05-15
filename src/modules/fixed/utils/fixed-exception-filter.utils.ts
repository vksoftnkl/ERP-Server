import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import type { FixedErrorDetail, FixedErrorResponse } from './fixed-service.utils';

export abstract class FixedExceptionFilter<
  TErrorDetail extends FixedErrorDetail,
  TErrorResponse extends FixedErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}
