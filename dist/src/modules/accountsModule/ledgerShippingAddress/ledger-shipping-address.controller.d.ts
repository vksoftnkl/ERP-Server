import { SaveLedgerShippingAddressDto } from './dto/save-ledger-shipping-address.dto';
import { LedgerShippingAddressService } from './ledger-shipping-address.service';
import { LedgerShippingAddressPayload, LedgerShippingAddressSuccessResponse } from './types/ledger-shipping-address-api.types';
export declare class LedgerShippingAddressController {
    private readonly ledgerShippingAddressService;
    constructor(ledgerShippingAddressService: LedgerShippingAddressService);
    save(saveLedgerShippingAddressDto: SaveLedgerShippingAddressDto): Promise<LedgerShippingAddressSuccessResponse<LedgerShippingAddressPayload>>;
    getById(saaId: string): Promise<LedgerShippingAddressSuccessResponse<LedgerShippingAddressPayload>>;
    remove(saaId: string): Promise<LedgerShippingAddressSuccessResponse<{
        saaId: string;
        deleted: true;
    }>>;
}
