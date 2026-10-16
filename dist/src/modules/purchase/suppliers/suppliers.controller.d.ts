import { SaveSupplierDto } from './dto/save-supplier.dto';
import { SuppliersService } from './suppliers.service';
import { SupplierPayload, SupplierSuccessResponse } from './types/supplier-api.types';
export declare class SuppliersController {
    private readonly suppliersService;
    constructor(suppliersService: SuppliersService);
    save(saveSupplierDto: SaveSupplierDto): Promise<SupplierSuccessResponse<SupplierPayload>>;
    getById(supId: string): Promise<SupplierSuccessResponse<SupplierPayload>>;
    remove(supId: string): Promise<SupplierSuccessResponse<{
        supId: string;
        deleted: true;
    }>>;
}
