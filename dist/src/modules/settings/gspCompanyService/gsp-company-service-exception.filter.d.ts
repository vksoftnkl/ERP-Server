import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { GspCompanyServiceErrorDetail, GspCompanyServiceErrorResponse } from './types/gsp-company-service-api.types';
export declare class GspCompanyServiceExceptionFilter extends SettingsExceptionFilter<GspCompanyServiceErrorDetail, GspCompanyServiceErrorResponse> {
    constructor();
}
