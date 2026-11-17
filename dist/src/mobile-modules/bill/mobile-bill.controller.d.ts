import { CreateMobileBillDto, MobileBillOptionsQueryDto } from './dto/mobile-bill.dto';
import { MobileBillService } from './mobile-bill.service';
import type { MobileBillCreateResult, MobileBillOptions } from './types/mobile-bill-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileBillController {
    private readonly mobileBillService;
    constructor(mobileBillService: MobileBillService);
    options(query: MobileBillOptionsQueryDto): Promise<MobileSuccess<MobileBillOptions>>;
    create(dto: CreateMobileBillDto): Promise<MobileSuccess<MobileBillCreateResult>>;
}
export {};
