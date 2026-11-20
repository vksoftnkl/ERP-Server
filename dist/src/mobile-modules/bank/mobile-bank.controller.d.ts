import { MobileBankListQueryDto } from './dto/mobile-bank.dto';
import { MobileBankService } from './mobile-bank.service';
import type { MobileBankList } from './types/mobile-bank-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileBankController {
    private readonly mobileBankService;
    constructor(mobileBankService: MobileBankService);
    list(query: MobileBankListQueryDto): Promise<MobileSuccess<MobileBankList>>;
}
export {};
