import { MobileMeService } from './mobile-me.service';
import type { MobileMe } from './types/mobile-me-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileMeController {
    private readonly mobileMeService;
    constructor(mobileMeService: MobileMeService);
    me(): Promise<MobileSuccess<MobileMe>>;
}
export {};
