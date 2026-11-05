import { GstinLookupQueryDto } from './dto/gstin-lookup-query.dto';
import { GstinLookupService } from './gstin-lookup.service';
import { GstinLookupPayload } from './types/gstin-lookup.types';
export declare class GstinLookupController {
    private readonly gstinLookupService;
    constructor(gstinLookupService: GstinLookupService);
    search(query: GstinLookupQueryDto): Promise<{
        success: true;
        message: string;
        data: GstinLookupPayload;
    }>;
}
