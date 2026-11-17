import { BillService } from './bill.service';
import { BillLifecycleService } from './bill-lifecycle.service';
import { BillReadService } from './bill-read.service';
import { BillBandService } from './bill-band.service';
import { BillRetenderService } from './bill-retender.service';
import { BillVoidService } from './bill-void.service';
import { BillVoucherTypeService } from './bill-voucher-type.service';
import { BillVoucherTypeChoicesQueryDto } from './dto/bill-voucher-type-choices.dto';
import { SaveBillDto } from './dto/save-bill.dto';
import { AmendBillDto, BillKeysDto, BillTransportDto, CancelBillDto, DeleteBillDto, PostBillDto, RetenderBillDto, UpdateRemarksDto, ValidateBillDto, VoidBillDto } from './dto/bill-lifecycle.dto';
import type { BillPayload, BillSuccessResponse } from './types/bill-api.types';
export declare class BillController {
    private readonly billService;
    private readonly lifecycle;
    private readonly voids;
    private readonly read;
    private readonly band;
    private readonly retenderService;
    private readonly voucherTypes;
    constructor(billService: BillService, lifecycle: BillLifecycleService, voids: BillVoidService, read: BillReadService, band: BillBandService, retenderService: BillRetenderService, voucherTypes: BillVoucherTypeService);
    private ok;
    save(dto: SaveBillDto): Promise<BillSuccessResponse<BillPayload>>;
    validate(dto: ValidateBillDto): Promise<BillSuccessResponse<Record<string, unknown>>>;
    post(dto: PostBillDto): Promise<BillSuccessResponse<BillPayload>>;
    cancel(dto: CancelBillDto): Promise<BillSuccessResponse<Record<string, unknown>>>;
    void(dto: VoidBillDto): Promise<BillSuccessResponse<Record<string, unknown>>>;
    voidCheck(query: BillKeysDto): Promise<BillSuccessResponse<Record<string, unknown>>>;
    amend(dto: AmendBillDto): Promise<BillSuccessResponse<BillPayload>>;
    remove(dto: DeleteBillDto): Promise<BillSuccessResponse<{
        sbId: string;
        deleted: true;
    }>>;
    getById(sbId: string, sbCompanyId: string, sbBranchId: string, sbAccYear: string): Promise<BillSuccessResponse<BillPayload>>;
    voucherTypeChoices(q: BillVoucherTypeChoicesQueryDto): Promise<BillSuccessResponse<unknown>>;
    openSources(companyId: string, branchId: string, partyId: string, kind: string, accYear?: string): Promise<BillSuccessResponse<unknown>>;
    partyContext(partyId: string, companyId: string, branchId: string, accYear: string, billDate?: string): Promise<BillSuccessResponse<Record<string, unknown>>>;
    deliveryStatus(_body: unknown): never;
    updateRemarks(dto: UpdateRemarksDto): Promise<BillSuccessResponse<{
        sbRemarks: string | null;
    }>>;
    transport(dto: BillTransportDto): Promise<BillSuccessResponse<unknown>>;
    tenderContext(sbId: string, sbCompanyId: string, sbBranchId: string, sbAccYear: string): Promise<BillSuccessResponse<Record<string, unknown>>>;
    retender(dto: RetenderBillDto): Promise<BillSuccessResponse<BillPayload>>;
}
