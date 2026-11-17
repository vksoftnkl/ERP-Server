import { DcReturnService } from './dc-return.service';
import { SaveDcReturnDto } from './dto/save-dc-return.dto';
import { CancelDcReturnDto, DcReturnKeysDto, DcReturnOpenLinesQueryDto, DcReturnTransportDto, PostDcReturnDto, ValidateDcReturnDto } from './dto/dc-return-lifecycle.dto';
export declare class DcReturnController {
    private readonly service;
    constructor(service: DcReturnService);
    save(dto: SaveDcReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    validate(dto: ValidateDcReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    post(dto: PostDcReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    cancel(dto: CancelDcReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    remove(dto: DcReturnKeysDto): Promise<{
        success: true;
        message: string;
        data: {
            sdrId: string;
            deleted: true;
        };
    }>;
    get(sdrId: string, sdrCompanyId: string, sdrBranchId: string, sdrAccYear: string): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    openLines(q: DcReturnOpenLinesQueryDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    transport(dto: DcReturnTransportDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
}
