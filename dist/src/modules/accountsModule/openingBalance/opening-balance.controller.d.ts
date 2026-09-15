import { OpeningBalanceService } from './opening-balance.service';
import { BillWiseService } from './bill-wise.service';
import { CarryForwardService } from './carry-forward.service';
import { ListOpeningBalanceQueryDto } from './dto/list-opening-balance-query.dto';
import { SaveOpeningBalanceDto } from './dto/save-opening-balance.dto';
import { ListOpeningBillsQueryDto, SaveOpeningBillsDto } from './dto/save-opening-bill.dto';
import { CarryForwardDto } from './dto/carry-forward.dto';
import type { CarryForwardPayload, OpeningBalanceDeletePayload, OpeningBalanceListPayload, OpeningBalanceSavePayload, OpeningBalanceSuccessResponse, OpeningBillsPayload, OpeningBillsSavePayload, TrialBalancePayload } from './types/opening-balance-api.types';
export declare class OpeningBalanceController {
    private readonly openingBalanceService;
    private readonly billWiseService;
    private readonly carryForwardService;
    constructor(openingBalanceService: OpeningBalanceService, billWiseService: BillWiseService, carryForwardService: CarryForwardService);
    list(query: ListOpeningBalanceQueryDto): Promise<OpeningBalanceSuccessResponse<OpeningBalanceListPayload>>;
    save(dto: SaveOpeningBalanceDto): Promise<OpeningBalanceSuccessResponse<OpeningBalanceSavePayload>>;
    trialBalance(query: ListOpeningBalanceQueryDto): Promise<OpeningBalanceSuccessResponse<TrialBalancePayload>>;
    remove(opId: string, accYear: string): Promise<OpeningBalanceSuccessResponse<OpeningBalanceDeletePayload>>;
    carryForward(dto: CarryForwardDto): Promise<OpeningBalanceSuccessResponse<CarryForwardPayload>>;
    listBills(query: ListOpeningBillsQueryDto): Promise<OpeningBalanceSuccessResponse<OpeningBillsPayload>>;
    saveBills(dto: SaveOpeningBillsDto): Promise<OpeningBalanceSuccessResponse<OpeningBillsSavePayload>>;
}
