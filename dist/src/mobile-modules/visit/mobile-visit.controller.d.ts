import { CreateMobileVisitDto } from './dto/mobile-visit.dto';
import { MobileVisitService } from './mobile-visit.service';
import type { MobileVisitCreateResult } from './types/mobile-visit-api.types';
export declare class MobileVisitController {
    private readonly mobileVisitService;
    constructor(mobileVisitService: MobileVisitService);
    create(dto: CreateMobileVisitDto): Promise<{
        success: true;
        message: string;
        data: MobileVisitCreateResult;
    }>;
}
