import { TillContextService } from './till-context.service';
import { TillMastersService } from './services/till-masters.service';
import { SaveTillApprovalAuthorityDto, SaveTillApprovalRuleDto, SaveTillCounterDto, SaveTillDenominationDto, SaveTillReasonDto, SaveTillSafeDto, TillDenominationListQueryDto, TillMasterKeyQueryDto } from './dto/save-till-masters.dto';
import type { TillApprovalAuthorityPayload, TillApprovalRulePayload, TillCounterPayload, TillDeletePayload, TillDenominationPayload, TillReasonPayload, TillSafePayload, TillSuccessResponse } from './types/till-api.types';
export declare class TillMastersController {
    private readonly context;
    private readonly masters;
    constructor(context: TillContextService, masters: TillMastersService);
    saveCounter(dto: SaveTillCounterDto): Promise<TillSuccessResponse<TillCounterPayload>>;
    getCounter(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillCounterPayload>>;
    deleteCounter(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDeletePayload>>;
    saveSafe(dto: SaveTillSafeDto): Promise<TillSuccessResponse<TillSafePayload>>;
    getSafe(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillSafePayload>>;
    deleteSafe(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDeletePayload>>;
    saveReason(dto: SaveTillReasonDto): Promise<TillSuccessResponse<TillReasonPayload>>;
    getReason(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillReasonPayload>>;
    deleteReason(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDeletePayload>>;
    saveDenomination(dto: SaveTillDenominationDto): Promise<TillSuccessResponse<TillDenominationPayload>>;
    getDenomination(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDenominationPayload>>;
    listDenominations(q: TillDenominationListQueryDto): Promise<TillSuccessResponse<TillDenominationPayload[]>>;
    deleteDenomination(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDeletePayload>>;
    saveRule(dto: SaveTillApprovalRuleDto): Promise<TillSuccessResponse<TillApprovalRulePayload>>;
    getRule(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillApprovalRulePayload>>;
    deleteRule(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDeletePayload>>;
    saveAuthority(dto: SaveTillApprovalAuthorityDto): Promise<TillSuccessResponse<TillApprovalAuthorityPayload>>;
    getAuthority(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillApprovalAuthorityPayload>>;
    deleteAuthority(q: TillMasterKeyQueryDto): Promise<TillSuccessResponse<TillDeletePayload>>;
    private requireSave;
}
