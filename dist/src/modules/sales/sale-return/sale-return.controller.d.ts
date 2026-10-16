import { SaleReturnService } from './sale-return.service';
import { SaveSaleReturnDto } from './dto/save-sale-return.dto';
import { AmendSaleReturnDto, CancelSaleReturnDto, PostSaleReturnDto, SaleReturnKeysDto, SaleReturnTransportDto, ValidateSaleReturnDto } from './dto/sale-return-lifecycle.dto';
export declare class SaleReturnController {
    private readonly service;
    constructor(service: SaleReturnService);
    save(dto: SaveSaleReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    validate(dto: ValidateSaleReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    post(dto: PostSaleReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    cancel(dto: CancelSaleReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    amend(dto: AmendSaleReturnDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    remove(dto: SaleReturnKeysDto): Promise<{
        success: true;
        message: string;
        data: {
            srId: string;
            deleted: true;
        };
    }>;
    get(srId: string, srCompanyId: string, srBranchId: string, srAccYear: string): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
    billLines(sbId: string, sbAccYear: string): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>[];
    }>;
    transport(dto: SaleReturnTransportDto): Promise<{
        success: true;
        message: string;
        data: Record<string, unknown>;
    }>;
}
