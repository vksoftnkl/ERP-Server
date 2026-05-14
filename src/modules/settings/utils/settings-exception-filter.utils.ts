import { ModuleExceptionFilter } from '../../../common/utils/module-shared.utils';
import { SettingsErrorDetail, SettingsErrorResponse } from './settings-service.utils';

export abstract class SettingsExceptionFilter<
  TErrorDetail extends SettingsErrorDetail,
  TErrorResponse extends SettingsErrorResponse<TErrorDetail>,
> extends ModuleExceptionFilter<TErrorDetail, TErrorResponse> {}
