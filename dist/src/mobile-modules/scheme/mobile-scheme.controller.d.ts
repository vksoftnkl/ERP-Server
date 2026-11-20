import { ActiveMobileSchemesQueryDto } from './dto/mobile-scheme.dto';
import { MobileSchemeService } from './mobile-scheme.service';
import type { MobileSchemesPayload } from './types/mobile-scheme-api.types';
type MobileSuccess<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class MobileSchemeController {
    private readonly mobileSchemeService;
    constructor(mobileSchemeService: MobileSchemeService);
    active(query: ActiveMobileSchemesQueryDto): Promise<MobileSuccess<MobileSchemesPayload>>;
}
export {};
