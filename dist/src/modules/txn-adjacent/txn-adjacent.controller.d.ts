import { TxnAdjacentQueryDto } from './dto/txn-adjacent-query.dto';
import { TxnAdjacentService, type TxnAdjacentPayload } from './txn-adjacent.service';
export declare class TxnAdjacentController {
    private readonly service;
    constructor(service: TxnAdjacentService);
    adjacent(q: TxnAdjacentQueryDto): Promise<{
        success: true;
        message: string;
        data: TxnAdjacentPayload;
    }>;
}
