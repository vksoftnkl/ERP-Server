export declare class VoucherErrorDetailDto {
    field: string;
    message: string;
    code: string;
    line?: number;
}
export declare class VoucherErrorResponseDto {
    success: false;
    message: string;
    errors: VoucherErrorDetailDto[];
}
declare abstract class SuccessEnvelopeDto {
    success: true;
    message: string;
}
export declare class VoucherTypesSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class LedgerPickSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class LedgerBalanceSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class PartyFactsSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class OpenBillsSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class TaxRatesSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class DraftSavedSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class ValidateSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class VoucherSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class CancelSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class DeleteSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export declare class AdjacentVoucherSuccessDto extends SuccessEnvelopeDto {
    data: unknown;
}
export {};
