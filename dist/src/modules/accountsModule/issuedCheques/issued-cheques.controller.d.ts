import type { VoucherSuccessResponse } from '../vouchers/types/vouchers-api.types';
import { IssuedChequesService } from './issued-cheques.service';
import { ChequeBooksService } from './cheque-books.service';
import { ChequeBookKeysDto, CloseChequeBookDto, IssuedChequeKeysDto, PresentedChequeDto, ReplaceChequeDto, ReverseChequeDto, SaveChequeBookDto, VoidChequeDto } from './dto/issued-cheques.dto';
import type { ChequeBookPayload, IssuedChequeHistoryPayload, IssuedChequePayload, ReplacedChequePayload } from './types/issued-cheques-api.types';
export declare class IssuedChequesController {
    private readonly service;
    constructor(service: IssuedChequesService);
    get(q: IssuedChequeKeysDto): Promise<VoucherSuccessResponse<IssuedChequePayload>>;
    history(q: IssuedChequeKeysDto): Promise<VoucherSuccessResponse<IssuedChequeHistoryPayload>>;
    presented(dto: PresentedChequeDto): Promise<VoucherSuccessResponse<IssuedChequePayload>>;
    returned(dto: ReverseChequeDto): Promise<VoucherSuccessResponse<IssuedChequePayload>>;
    stop(dto: ReverseChequeDto): Promise<VoucherSuccessResponse<IssuedChequePayload>>;
    void(dto: VoidChequeDto): Promise<VoucherSuccessResponse<IssuedChequePayload>>;
    replace(dto: ReplaceChequeDto): Promise<VoucherSuccessResponse<ReplacedChequePayload>>;
}
export declare class ChequeBooksController {
    private readonly service;
    constructor(service: ChequeBooksService);
    get(q: ChequeBookKeysDto): Promise<VoucherSuccessResponse<ChequeBookPayload>>;
    save(dto: SaveChequeBookDto): Promise<VoucherSuccessResponse<ChequeBookPayload>>;
    close(dto: CloseChequeBookDto): Promise<VoucherSuccessResponse<ChequeBookPayload>>;
}
