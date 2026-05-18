import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import { InventoryErrorDetail, InventoryErrorResponse } from '../../../common/utils/module-service.utils';
export abstract class InventoryExceptionFilter<
  TErrorDetail extends InventoryErrorDetail,
  TErrorResponse extends InventoryErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}