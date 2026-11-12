import { ItemLedgerService } from './item-ledger.service';
import { ItemLedgerExportDto, ItemLedgerMonthsDto, ItemLedgerOptionsDto, ItemLedgerQueryDto, ItemLedgerScopeDto } from './dto/item-ledger-query.dto';
import type { DaysPayload, ExportPayload, LedgerPayload, MonthsPayload, OptionsPayload } from './types/item-ledger.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class ItemLedgerController {
    private readonly service;
    constructor(service: ItemLedgerService);
    options(q: ItemLedgerOptionsDto): Promise<Ok<OptionsPayload>>;
    ledger(q: ItemLedgerQueryDto): Promise<Ok<LedgerPayload>>;
    days(q: ItemLedgerScopeDto): Promise<Ok<DaysPayload>>;
    months(q: ItemLedgerMonthsDto): Promise<Ok<MonthsPayload>>;
    export(q: ItemLedgerExportDto): Promise<Ok<ExportPayload>>;
}
export {};
