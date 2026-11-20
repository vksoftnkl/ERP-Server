import { DataChangeService } from '../../common/data-changes/data-change.service';
import { CreateMobileReturnDto, DeleteMobileReturnDto, MobileReturnBillLinesQueryDto, MobileReturnOptionsQueryDto, MobileReturnStatusQueryDto } from './dto/mobile-return.dto';
import { MobileReturnService } from './mobile-return.service';
import { MobileReturnStatusService } from './mobile-return-status.service';
import type { MobileReturnBillLinesPayload, MobileReturnCreateResult, MobileReturnDeleteResult, MobileReturnOptions, MobileReturnStatusPayload } from './types/mobile-return-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
type SessionRequest = {
    user?: {
        sid?: string | null;
    };
    query?: unknown;
    headers?: Record<string, unknown>;
};
export declare class MobileReturnController {
    private readonly mobileReturnService;
    private readonly mobileReturnStatusService;
    private readonly dataChangeService;
    constructor(mobileReturnService: MobileReturnService, mobileReturnStatusService: MobileReturnStatusService, dataChangeService: DataChangeService);
    options(query: MobileReturnOptionsQueryDto): Promise<MobileSuccess<MobileReturnOptions>>;
    billLines(query: MobileReturnBillLinesQueryDto): Promise<MobileSuccess<MobileReturnBillLinesPayload>>;
    status(query: MobileReturnStatusQueryDto): Promise<MobileSuccess<MobileReturnStatusPayload>>;
    create(dto: CreateMobileReturnDto, request: SessionRequest): Promise<MobileSuccess<MobileReturnCreateResult>>;
    remove(dto: DeleteMobileReturnDto, request: SessionRequest): Promise<MobileSuccess<MobileReturnDeleteResult>>;
    private publish;
}
export {};
