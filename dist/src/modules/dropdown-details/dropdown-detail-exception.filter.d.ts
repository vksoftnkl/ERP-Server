import { FixedExceptionFilter } from "../../common/utils/module-exception-filter.utils";
import { DropdownDetailErrorDetail, DropdownDetailErrorResponse } from './types/dropdown-detail-api.types';
export declare class DropdownDetailExceptionFilter extends FixedExceptionFilter<DropdownDetailErrorDetail, DropdownDetailErrorResponse> {
    constructor();
}
