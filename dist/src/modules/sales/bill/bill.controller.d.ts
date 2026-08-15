import { BillService } from './bill.service';
import { SaveBillDto } from './dto/save-bill.dto';
import { CancelBillDto } from './dto/cancel-bill.dto';
import { BillCancelResult, BillPayload, BillSuccessResponse } from './types/bill-api.types';
export declare class BillController {
    private readonly billService;
    constructor(billService: BillService);
    save(saveBillDto: SaveBillDto): Promise<BillSuccessResponse<BillPayload>>;
    getById(sbId: string, sbCompanyId: string, sbBranchId: string, sbAccYear: string): Promise<BillSuccessResponse<BillPayload>>;
    remove(cancelBillDto: CancelBillDto): Promise<BillSuccessResponse<BillCancelResult>>;
}
