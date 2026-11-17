import { CreateMobileReceiptDto, MobileOpenBillsQueryDto, MobileReceiptOptionsQueryDto } from './dto/mobile-receipt.dto';
import { MobileReceiptService } from './mobile-receipt.service';
import type { MobileOpenBillsPayload, MobileReceiptCreateResult, MobileReceiptOptions } from './types/mobile-receipt-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileReceiptController {
    private readonly mobileReceiptService;
    constructor(mobileReceiptService: MobileReceiptService);
    options(query: MobileReceiptOptionsQueryDto): Promise<MobileSuccess<MobileReceiptOptions>>;
    openBills(query: MobileOpenBillsQueryDto): Promise<MobileSuccess<MobileOpenBillsPayload>>;
    create(dto: CreateMobileReceiptDto): Promise<MobileSuccess<MobileReceiptCreateResult>>;
}
export {};
