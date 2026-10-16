import { ChequesService } from './cheques.service';
import { ChequeDepositService } from './cheque-deposit.service';
import { ChequeClearService } from './cheque-clear.service';
import { ChequeBounceService } from './cheque-bounce.service';
import { ChequeReissueService } from './cheque-reissue.service';
import { ChequeReturnService } from './cheque-return.service';
import { ChequeHistoryQueryDto, DepositSlipQueryDto, GetChequeQueryDto, ListChequesQueryDto } from './dto/cheque-query.dto';
import { DepositChequesDto } from './dto/deposit-cheques.dto';
import { BounceChequeDto, ClearChequeDto, ReplaceChequeDto, RepresentChequeDto, ReturnChequeDto } from './dto/cheque-actions.dto';
import type { ChequeBouncePayload, ChequeClearPayload, ChequeDepositPayload, ChequeDetailPayload, ChequeHistoryPayload, ChequeListPayload, ChequeReplacePayload, ChequeRepresentPayload, ChequeReturnPayload, ChequeSuccessResponse, DepositSlipPayload } from './types/cheque-api.types';
export declare class ChequesController {
    private readonly chequesService;
    private readonly depositService;
    private readonly clearService;
    private readonly bounceService;
    private readonly reissueService;
    private readonly returnService;
    constructor(chequesService: ChequesService, depositService: ChequeDepositService, clearService: ChequeClearService, bounceService: ChequeBounceService, reissueService: ChequeReissueService, returnService: ChequeReturnService);
    list(query: ListChequesQueryDto): Promise<ChequeSuccessResponse<ChequeListPayload>>;
    get(query: GetChequeQueryDto): Promise<ChequeSuccessResponse<ChequeDetailPayload>>;
    history(query: ChequeHistoryQueryDto): Promise<ChequeSuccessResponse<ChequeHistoryPayload>>;
    deposit(dto: DepositChequesDto): Promise<ChequeSuccessResponse<ChequeDepositPayload>>;
    clear(dto: ClearChequeDto): Promise<ChequeSuccessResponse<ChequeClearPayload>>;
    bounce(dto: BounceChequeDto): Promise<ChequeSuccessResponse<ChequeBouncePayload>>;
    represent(dto: RepresentChequeDto): Promise<ChequeSuccessResponse<ChequeRepresentPayload>>;
    replace(dto: ReplaceChequeDto): Promise<ChequeSuccessResponse<ChequeReplacePayload>>;
    return(dto: ReturnChequeDto): Promise<ChequeSuccessResponse<ChequeReturnPayload>>;
    depositSlip(query: DepositSlipQueryDto): Promise<ChequeSuccessResponse<DepositSlipPayload>>;
}
