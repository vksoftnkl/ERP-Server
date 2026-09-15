import { BillBalanceRecomputeService } from '../billBalance/bill-balance-recompute.service';
import { ReceiptService } from './receipt.service';
import { ReceiptPostingService } from './receipt-posting.service';
import { ReceiptCancelService } from './receipt-cancel.service';
import { OpenItemsService } from './open-items.service';
import { ListOpenItemsQueryDto, PartyContextQueryDto } from './dto/open-item.dto';
import { RegularisePdcDto, SaveReceiptDto, UpdateReceiptHeaderDto } from './dto/save-receipt.dto';
import { CancelReceiptDto, GetReceiptQueryDto, PostReceiptDto } from './dto/post-receipt.dto';
import type { OpenItemsPayload, PartyContextPayload, ReceiptCancelPayload, ReceiptDraftPayload, ReceiptHeader, ReceiptPayload, ReceiptPostPayload, ReceiptSuccessResponse, RegularisePdcPayload } from './types/receipt-api.types';
export declare class ReceiptController {
    private readonly receiptService;
    private readonly postingService;
    private readonly cancelService;
    private readonly openItemsService;
    private readonly recompute;
    constructor(receiptService: ReceiptService, postingService: ReceiptPostingService, cancelService: ReceiptCancelService, openItemsService: OpenItemsService, recompute: BillBalanceRecomputeService);
    openItems(query: ListOpenItemsQueryDto): Promise<ReceiptSuccessResponse<OpenItemsPayload>>;
    partyContext(query: PartyContextQueryDto): Promise<ReceiptSuccessResponse<PartyContextPayload>>;
    get(query: GetReceiptQueryDto): Promise<ReceiptSuccessResponse<ReceiptPayload>>;
    create(dto: SaveReceiptDto): Promise<ReceiptSuccessResponse<ReceiptDraftPayload>>;
    postReceipt(dto: PostReceiptDto): Promise<ReceiptSuccessResponse<ReceiptPostPayload>>;
    updateHeader(dto: UpdateReceiptHeaderDto, body: Record<string, unknown>): Promise<ReceiptSuccessResponse<ReceiptHeader>>;
    cancel(dto: CancelReceiptDto): Promise<ReceiptSuccessResponse<ReceiptCancelPayload>>;
    regularise(dto: RegularisePdcDto): Promise<ReceiptSuccessResponse<RegularisePdcPayload>>;
}
