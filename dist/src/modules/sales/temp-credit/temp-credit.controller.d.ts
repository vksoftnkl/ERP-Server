import { SalesExceptionFilter } from "../../../common/utils/module-exception-filter.utils";
import type { ModuleErrorDetail, ModuleErrorResponse } from "../../../common/utils/module-service.utils";
import { OpenTempCreditsQueryDto, TempCreditFollowUpDto } from './dto/temp-credit.dto';
import { TempCreditService } from './temp-credit.service';
export declare class TempCreditExceptionFilter extends SalesExceptionFilter<ModuleErrorDetail, ModuleErrorResponse<ModuleErrorDetail>> {
    constructor();
}
export declare class TempCreditController {
    private readonly service;
    constructor(service: TempCreditService);
    open(q: OpenTempCreditsQueryDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>[];
    }>;
    followUp(dto: TempCreditFollowUpDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
}
