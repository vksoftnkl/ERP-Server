import { SaveSupplierGroupDto } from './dto/save-supplier-group.dto';
import { SupplierGroupService } from './supplier-group.service';
import { SupplierGroupPayload, SupplierGroupSuccessResponse } from './types/supplier-group-api.types';
export declare class SupplierGroupController {
    private readonly supplierGroupService;
    constructor(supplierGroupService: SupplierGroupService);
    save(saveSupplierGroupDto: SaveSupplierGroupDto): Promise<SupplierGroupSuccessResponse<SupplierGroupPayload>>;
    getById(spgId: string): Promise<SupplierGroupSuccessResponse<SupplierGroupPayload>>;
    remove(spgId: string): Promise<SupplierGroupSuccessResponse<{
        spgId: string;
        deleted: true;
    }>>;
}
