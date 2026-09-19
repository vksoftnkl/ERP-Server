import { DeleteLedgerMapQueryDto, SaveLedgerMapDto } from './dto/save-ledger-map.dto';
import { LedgerMapService } from './ledger-map.service';
import type { LedgerMapDeletePayload, LedgerMapRolePayload, LedgerMapSuccessResponse } from './types/ledger-map-api.types';
export declare class LedgerMapController {
    private readonly ledgerMapService;
    constructor(ledgerMapService: LedgerMapService);
    listRoles(): Promise<LedgerMapSuccessResponse<LedgerMapRolePayload[]>>;
    save(saveLedgerMapDto: SaveLedgerMapDto): Promise<LedgerMapSuccessResponse<LedgerMapRolePayload>>;
    remove(query: DeleteLedgerMapQueryDto): Promise<LedgerMapSuccessResponse<LedgerMapDeletePayload>>;
}
