import { SettingsExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { BranchMasterErrorDetail, BranchMasterErrorResponse } from './types/branch-master-api.types';
export declare class BranchMasterExceptionFilter extends SettingsExceptionFilter<BranchMasterErrorDetail, BranchMasterErrorResponse> {
    constructor();
}
