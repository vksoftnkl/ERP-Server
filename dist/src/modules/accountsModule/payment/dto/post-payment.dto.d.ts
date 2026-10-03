import { PostReceiptAllocationDto, PostReceiptCreditDto, PostReceiptOtherLinePinDto, ReceiptKeysDto } from '../../receipt/dto/post-receipt.dto';
export declare class PaymentKeysDto extends ReceiptKeysDto {
}
export { PostReceiptAllocationDto as PostPaymentAllocationDto, PostReceiptCreditDto as PostPaymentCreditDto, PostReceiptOtherLinePinDto as PostPaymentOtherLinePinDto, };
export declare class PostPaymentDto extends PaymentKeysDto {
    allocations: PostReceiptAllocationDto[];
    creditsApplied: PostReceiptCreditDto[];
    otherLineBills: PostReceiptOtherLinePinDto[];
    onAccount: number;
}
export declare class CancelPaymentDto extends PaymentKeysDto {
    reason: string;
}
export declare class GetPaymentQueryDto extends PaymentKeysDto {
}
export declare class DeletePaymentDto extends PaymentKeysDto {
}
