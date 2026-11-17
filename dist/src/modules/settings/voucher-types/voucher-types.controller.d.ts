import { SaveVoucherTypeDto, ValidateVoucherTypeDto } from './dto/save-voucher-type.dto';
import { PrintDesignCloneDto, VoucherTypeGetQueryDto, VoucherTypeRefDto, VoucherTypeTreeQueryDto } from './dto/voucher-type-query.dto';
import { VoucherTypesService } from './voucher-types.service';
export declare class VoucherTypesController {
    private readonly service;
    constructor(service: VoucherTypesService);
    tree(q: VoucherTypeTreeQueryDto): Promise<{
        success: boolean;
        message: string;
        data: {
            nodes: import("./types/voucher-types-api.types").VoucherTypeNode[];
        };
    }>;
    get(q: VoucherTypeGetQueryDto): Promise<{
        success: boolean;
        message: string;
        data: import("./types/voucher-types-api.types").VoucherTypePayload;
    }>;
    validate(dto: ValidateVoucherTypeDto): Promise<{
        success: boolean;
        message: string;
        data: import("./types/voucher-types-api.types").VoucherTypeValidation;
    }>;
    save(dto: SaveVoucherTypeDto): Promise<{
        success: boolean;
        message: string;
        data: import("./types/voucher-types-api.types").VoucherTypePayload & {
            warnings: import("./voucher-types.rules").VtIssue[];
        };
    }>;
    inactivate(dto: VoucherTypeRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            vchrTypeId: number;
            vchrIsActive: false;
        };
    }>;
    remove(dto: VoucherTypeRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            vchrTypeId: number;
            deleted: true;
        };
    }>;
    clonePrintDesign(dto: PrintDesignCloneDto): Promise<{
        success: boolean;
        message: string;
        data: import("./types/voucher-types-api.types").VoucherTypePrintDesign;
    }>;
}
