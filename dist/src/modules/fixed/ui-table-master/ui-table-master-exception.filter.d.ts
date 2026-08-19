import { FixedExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { UiTableMasterErrorDetail, UiTableMasterErrorResponse } from './types/ui-table-master-api.types';
export declare class UiTableMasterExceptionFilter extends FixedExceptionFilter<UiTableMasterErrorDetail, UiTableMasterErrorResponse> {
    constructor();
}
