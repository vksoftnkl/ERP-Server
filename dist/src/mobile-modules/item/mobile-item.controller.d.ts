import { ListMobileItemsQueryDto } from './dto/mobile-item.dto';
import { MobileItemService } from './mobile-item.service';
import type { MobileItemListPayload, MobileItemOptions } from './types/mobile-item-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileItemController {
    private readonly mobileItemService;
    constructor(mobileItemService: MobileItemService);
    options(): Promise<MobileSuccess<MobileItemOptions>>;
    list(query: ListMobileItemsQueryDto): Promise<MobileSuccess<MobileItemListPayload>>;
}
export {};
