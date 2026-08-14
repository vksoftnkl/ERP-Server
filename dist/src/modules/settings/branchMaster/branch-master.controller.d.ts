import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import { BranchMasterService } from './branch-master.service';
import { BranchMasterPayload, BranchMasterSuccessResponse } from './types/branch-master-api.types';
export declare class BranchMasterController {
    private readonly branchMasterService;
    constructor(branchMasterService: BranchMasterService);
    save(saveBranchMasterDto: SaveBranchMasterDto): Promise<BranchMasterSuccessResponse<BranchMasterPayload>>;
    getById(brId: string): Promise<BranchMasterSuccessResponse<BranchMasterPayload>>;
    remove(brId: string): Promise<BranchMasterSuccessResponse<{
        brId: string;
        deleted: true;
    }>>;
}
