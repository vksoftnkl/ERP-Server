import { DeliveryChallanService } from './delivery-challan.service';
import { SaveDeliveryChallanDto } from './dto/save-delivery-challan.dto';
import { AmendDeliveryChallanDto, CancelDeliveryChallanDto, ConvertPurposeDto, DeliveryChallanKeysDto, DeliveryChallanTransportDto, PostDeliveryChallanDto, ValidateDeliveryChallanDto } from './dto/delivery-challan-lifecycle.dto';
type Ok<T> = {
    success: true;
    message: string;
    data: T;
};
export declare class DeliveryChallanController {
    private readonly service;
    constructor(service: DeliveryChallanService);
    save(dto: SaveDeliveryChallanDto): Promise<Ok<Record<string, unknown>>>;
    validate(dto: ValidateDeliveryChallanDto): Promise<Ok<Record<string, unknown>>>;
    post(dto: PostDeliveryChallanDto): Promise<Ok<Record<string, unknown>>>;
    cancel(dto: CancelDeliveryChallanDto): Promise<Ok<Record<string, unknown>>>;
    amend(dto: AmendDeliveryChallanDto): Promise<Ok<Record<string, unknown>>>;
    remove(dto: DeliveryChallanKeysDto): Promise<Ok<{
        sdcId: string;
        deleted: true;
    }>>;
    get(sdcId: string, sdcCompanyId: string, sdcBranchId: string, sdcAccYear: string): Promise<Ok<Record<string, unknown>>>;
    openForBill(companyId: string, branchId: string, partyId: string, accYear?: string): Promise<Ok<import("../bill/bill-read.service").OpenSourceDoc[]>>;
    convertPurpose(dto: ConvertPurposeDto): Promise<Ok<Record<string, unknown>>>;
    transport(dto: DeliveryChallanTransportDto): Promise<Ok<Record<string, unknown>>>;
}
export {};
