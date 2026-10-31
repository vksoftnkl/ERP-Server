import type { LoyaltyAdjustResult } from '../../posting/types/loyalty.types';
import { LoyaltyMemberAdjustDto, LoyaltyMemberHistoryDto, LoyaltyMemberStatusDto } from './dto/loyalty-member-action.dto';
import { LoyaltyMembersService, type HistoryStep, type StatusChangeResult } from './loyalty-members.service';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class LoyaltyMembersController {
    private readonly service;
    constructor(service: LoyaltyMembersService);
    status(dto: LoyaltyMemberStatusDto): Promise<Ok<StatusChangeResult>>;
    adjust(dto: LoyaltyMemberAdjustDto): Promise<Ok<LoyaltyAdjustResult>>;
    history(q: LoyaltyMemberHistoryDto): Promise<Ok<{
        memberId: string;
        steps: HistoryStep[];
    }>>;
}
export {};
