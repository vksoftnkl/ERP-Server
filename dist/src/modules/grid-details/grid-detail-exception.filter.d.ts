import { FixedExceptionFilter } from "../../common/utils/module-exception-filter.utils";
import { GridDetailErrorDetail, GridDetailErrorResponse } from './types/grid-detail-api.types';
export declare class GridDetailExceptionFilter extends FixedExceptionFilter<GridDetailErrorDetail, GridDetailErrorResponse> {
    constructor();
}
