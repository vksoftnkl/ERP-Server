import { RequestContextService } from '../../../common/request-context/request-context.service';
import { VoucherTypesService } from './voucher-types.service';
import { VoucherLookupsService } from './voucher-lookups.service';
import { VoucherRegisterService } from './voucher-register.service';
import { VoucherCancelService } from './voucher-cancel.service';
import { AdjacentVoucherQueryDto, LedgerBalanceQueryDto, LedgerPickQueryDto, OpenBillsQueryDto, PartyFactsQueryDto, TaxRatesQueryDto, VoucherTypesQueryDto } from './dto/voucher-query.dto';
import { CancelVoucherDto, DeleteVoucherDto, GetVoucherQueryDto, PostVoucherDto, ValidateVoucherDto, VoucherPayloadDto } from './dto/voucher-payload.dto';
import type { AdjacentVoucherPayload, CancelPayload, DeletePayload, DraftSavedPayload, LedgerBalancePayload, LedgerPickPayload, OpenBillsPayload, PartyFactsPayload, TaxRatesPayload, ValidatePayload, VoucherPayload, VoucherSuccessResponse, VoucherTypesPayload } from './types/vouchers-api.types';
export declare class VouchersController {
    private readonly requestContext;
    private readonly types;
    private readonly lookups;
    private readonly register;
    private readonly cancelService;
    constructor(requestContext: RequestContextService, types: VoucherTypesService, lookups: VoucherLookupsService, register: VoucherRegisterService, cancelService: VoucherCancelService);
    listTypes(q: VoucherTypesQueryDto): Promise<VoucherSuccessResponse<VoucherTypesPayload>>;
    ledgerPick(q: LedgerPickQueryDto): Promise<VoucherSuccessResponse<LedgerPickPayload>>;
    ledgerBalance(q: LedgerBalanceQueryDto): Promise<VoucherSuccessResponse<LedgerBalancePayload>>;
    partyFacts(q: PartyFactsQueryDto): Promise<VoucherSuccessResponse<PartyFactsPayload>>;
    openBills(q: OpenBillsQueryDto): Promise<VoucherSuccessResponse<OpenBillsPayload>>;
    taxRates(q: TaxRatesQueryDto): Promise<VoucherSuccessResponse<TaxRatesPayload>>;
    get(q: GetVoucherQueryDto): Promise<VoucherSuccessResponse<VoucherPayload>>;
    adjacent(q: AdjacentVoucherQueryDto): Promise<VoucherSuccessResponse<AdjacentVoucherPayload>>;
    create(dto: VoucherPayloadDto, raw: Record<string, unknown>): Promise<VoucherSuccessResponse<DraftSavedPayload>>;
    validate(dto: ValidateVoucherDto): Promise<VoucherSuccessResponse<ValidatePayload>>;
    post(dto: PostVoucherDto): Promise<VoucherSuccessResponse<VoucherPayload>>;
    cancel(dto: CancelVoucherDto): Promise<VoucherSuccessResponse<CancelPayload>>;
    delete(dto: DeleteVoucherDto): Promise<VoucherSuccessResponse<DeletePayload>>;
}
