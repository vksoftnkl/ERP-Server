import { PartyOutstandingService } from './party-outstanding.service';
import { OutstandingBillHistoryDto, OutstandingBillWiseDto, OutstandingDueCalendarDto, OutstandingExportDto, OutstandingOptionsDto, OutstandingPartiesDto, OutstandingPartyDto, OutstandingSummaryDto } from './dto/party-outstanding-query.dto';
import type { BillHistoryPayload, BillsPayload, BillWisePayload, DueCalendarPayload, ExportPayload, OptionsPayload, PartiesPayload, PartyCardPayload, SummaryPayload } from './types/party-outstanding.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class PartyOutstandingController {
    private readonly service;
    constructor(service: PartyOutstandingService);
    options(q: OutstandingOptionsDto): Promise<Ok<OptionsPayload>>;
    parties(q: OutstandingPartiesDto): Promise<Ok<PartiesPayload>>;
    party(q: OutstandingPartyDto): Promise<Ok<PartyCardPayload>>;
    bills(q: OutstandingPartyDto): Promise<Ok<BillsPayload>>;
    billWise(q: OutstandingBillWiseDto): Promise<Ok<BillWisePayload>>;
    billHistory(q: OutstandingBillHistoryDto): Promise<Ok<BillHistoryPayload>>;
    summary(q: OutstandingSummaryDto): Promise<Ok<SummaryPayload>>;
    dueCalendar(q: OutstandingDueCalendarDto): Promise<Ok<DueCalendarPayload>>;
    export(q: OutstandingExportDto): Promise<Ok<ExportPayload>>;
}
export {};
