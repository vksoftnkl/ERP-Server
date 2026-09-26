import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import { CityErrorDetail, CityErrorResponse } from './types/city-api.types';
export declare class CityExceptionFilter extends SalesExceptionFilter<CityErrorDetail, CityErrorResponse> {
    constructor();
}
