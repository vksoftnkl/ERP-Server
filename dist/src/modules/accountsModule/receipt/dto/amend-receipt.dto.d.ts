import { SaveReceiptDto } from './save-receipt.dto';
import { PostReceiptAllocationDto, PostReceiptCreditDto, PostReceiptOtherLinePinDto } from './post-receipt.dto';
export declare class AmendReceiptDto extends SaveReceiptDto {
    avhVoucherId: string;
    allocations: PostReceiptAllocationDto[];
    creditsApplied: PostReceiptCreditDto[];
    otherLineBills: PostReceiptOtherLinePinDto[];
    onAccount: number;
    baseRevision: number;
    editRemark: string;
}
