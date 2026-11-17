import { DataChangeService } from '../../common/data-changes/data-change.service';
import { CreateMobileOrderDto } from './dto/mobile-order.dto';
import { MobileOrderService } from './mobile-order.service';
import type { MobileOrderCreateResult } from './types/mobile-order-api.types';
type SessionRequest = {
    user?: {
        sid?: string | null;
    };
};
export declare class MobileOrderController {
    private readonly mobileOrderService;
    private readonly dataChangeService;
    constructor(mobileOrderService: MobileOrderService, dataChangeService: DataChangeService);
    create(dto: CreateMobileOrderDto, request: SessionRequest): Promise<{
        success: true;
        message: string;
        data: MobileOrderCreateResult;
    }>;
}
export {};
