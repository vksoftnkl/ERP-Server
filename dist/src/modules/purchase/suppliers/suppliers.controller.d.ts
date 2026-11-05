import { DataChangeService } from '../../../common/data-changes/data-change.service';
import type { PartyDeleteCheck } from '../../../common/party/party-balance.service';
import { SaveSupplierDto } from './dto/save-supplier.dto';
import { SuppliersService } from './suppliers.service';
import { SupplierPayload, SupplierSavePayload, SupplierSuccessResponse } from './types/supplier-api.types';
export declare class SuppliersController {
    private readonly suppliersService;
    private readonly dataChangeService;
    constructor(suppliersService: SuppliersService, dataChangeService: DataChangeService);
    save(saveSupplierDto: SaveSupplierDto, request: {
        user?: {
            sid?: string | null;
        };
    }): Promise<SupplierSuccessResponse<SupplierSavePayload>>;
    getById(supId: string): Promise<SupplierSuccessResponse<SupplierPayload>>;
    deleteCheck(supId: string): Promise<SupplierSuccessResponse<PartyDeleteCheck>>;
    remove(supId: string): Promise<SupplierSuccessResponse<{
        supId: string;
        deleted: true;
    }>>;
}
