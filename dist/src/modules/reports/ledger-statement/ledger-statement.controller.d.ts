import { LedgerStatementService } from './ledger-statement.service';
import { LedgerStatementExportDto, LedgerStatementLedgersDto, LedgerStatementRangeDto, LedgerStatementScopeDto, LedgerStatementVoucherLegsDto, LedgerStatementVouchersDto } from './dto/ledger-statement-query.dto';
import type { DailyPayload, ExportPayload, LedgerHeaderPayload, LedgerPickPayload, MonthlyPayload, VoucherLegsPayload, VouchersPayload } from './types/ledger-statement.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class LedgerStatementController {
    private readonly service;
    constructor(service: LedgerStatementService);
    ledgers(q: LedgerStatementLedgersDto): Promise<Ok<LedgerPickPayload>>;
    header(q: LedgerStatementRangeDto): Promise<Ok<LedgerHeaderPayload>>;
    vouchers(q: LedgerStatementVouchersDto): Promise<Ok<VouchersPayload>>;
    voucherLegs(q: LedgerStatementVoucherLegsDto): Promise<Ok<VoucherLegsPayload>>;
    daily(q: LedgerStatementRangeDto): Promise<Ok<DailyPayload>>;
    monthly(q: LedgerStatementScopeDto): Promise<Ok<MonthlyPayload>>;
    export(q: LedgerStatementExportDto): Promise<Ok<ExportPayload>>;
}
export {};
