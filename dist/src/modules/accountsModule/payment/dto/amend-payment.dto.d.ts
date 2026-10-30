import { PostReceiptAllocationDto, PostReceiptCreditDto, PostReceiptOtherLinePinDto } from '../../receipt/dto/post-receipt.dto';
import { SavePaymentDto } from './save-payment.dto';
export declare class AmendPaymentDto extends SavePaymentDto {
    avhVoucherId: string;
    allocations: PostReceiptAllocationDto[];
    creditsApplied: PostReceiptCreditDto[];
    otherLineBills: PostReceiptOtherLinePinDto[];
    onAccount: number;
    baseRevision: number;
    editRemark: string;
}
