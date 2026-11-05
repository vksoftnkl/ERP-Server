import { DaySummaryService } from './day-summary.service';
import { DaySummaryCheckDetailDto, DaySummaryExportDto, DaySummaryGroupLedgersDto, DaySummaryScopeDto, DaySummaryVouchersDto } from './dto/day-summary-query.dto';
import type { CheckDetailPayload, DailyPayload, ExportPayload, GroupLedgersPayload, SummaryPayload, VouchersPayload, VoucherTypesPayload } from './types/day-summary.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class DaySummaryController {
    private readonly service;
    constructor(service: DaySummaryService);
    voucherTypes(): Promise<Ok<VoucherTypesPayload>>;
    summary(q: DaySummaryScopeDto): Promise<Ok<SummaryPayload>>;
    vouchers(q: DaySummaryVouchersDto): Promise<Ok<VouchersPayload>>;
    daily(q: DaySummaryScopeDto): Promise<Ok<DailyPayload>>;
    groupLedgers(q: DaySummaryGroupLedgersDto): Promise<Ok<GroupLedgersPayload>>;
    checkDetail(q: DaySummaryCheckDetailDto): Promise<Ok<CheckDetailPayload>>;
    export(q: DaySummaryExportDto): Promise<Ok<ExportPayload>>;
}
export {};
