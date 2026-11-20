import { CreateMobileReceiptDto, MobileOpenBillsQueryDto, MobileReceiptOptionsQueryDto, MobileReceiptStatusQueryDto } from './dto/mobile-receipt.dto';
import { MobileReceiptService } from './mobile-receipt.service';
import { MobileReceiptStatusService } from './mobile-receipt-status.service';
import type { MobileOpenBillsPayload, MobileReceiptCreateResult, MobileReceiptOptions, MobileReceiptStatusPayload } from './types/mobile-receipt-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileReceiptController {
    private readonly mobileReceiptService;
    private readonly mobileReceiptStatusService;
    constructor(mobileReceiptService: MobileReceiptService, mobileReceiptStatusService: MobileReceiptStatusService);
    options(query: MobileReceiptOptionsQueryDto): Promise<MobileSuccess<MobileReceiptOptions>>;
    openBills(query: MobileOpenBillsQueryDto): Promise<MobileSuccess<MobileOpenBillsPayload>>;
    status(query: MobileReceiptStatusQueryDto): Promise<MobileSuccess<MobileReceiptStatusPayload>>;
    create(dto: CreateMobileReceiptDto): Promise<MobileSuccess<MobileReceiptCreateResult>>;
}
export {};
