import { LoyaltyStatusService } from './loyalty-status.service';
import { LoyaltyStatusCalendarDto, LoyaltyStatusExpiringDto, LoyaltyStatusExportDto, LoyaltyStatusGiftsDto, LoyaltyStatusMemberDto, LoyaltyStatusMembersDto, LoyaltyStatusMonthlyDto, LoyaltyStatusSchemesDto, LoyaltyStatusStatementDto } from './dto/loyalty-status-query.dto';
import type { CalendarPayload, ExpiringPayload, ExportPayload, GiftsPayload, MemberPayload, MembersPayload, MonthlyPayload, SchemesPayload, StatementPayload } from './types/loyalty-status.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class LoyaltyStatusController {
    private readonly service;
    constructor(service: LoyaltyStatusService);
    members(q: LoyaltyStatusMembersDto): Promise<Ok<MembersPayload>>;
    statement(q: LoyaltyStatusStatementDto): Promise<Ok<StatementPayload>>;
    member(q: LoyaltyStatusMemberDto): Promise<Ok<MemberPayload>>;
    expiring(q: LoyaltyStatusExpiringDto): Promise<Ok<ExpiringPayload>>;
    calendar(q: LoyaltyStatusCalendarDto): Promise<Ok<CalendarPayload>>;
    schemes(q: LoyaltyStatusSchemesDto): Promise<Ok<SchemesPayload>>;
    monthly(q: LoyaltyStatusMonthlyDto): Promise<Ok<MonthlyPayload>>;
    gifts(q: LoyaltyStatusGiftsDto): Promise<Ok<GiftsPayload>>;
    export(q: LoyaltyStatusExportDto): Promise<Ok<ExportPayload>>;
}
export {};
