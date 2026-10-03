import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
export declare class SaveStockTransferReceiveHeaderDto extends SaveStockVoucherHeaderDto {
    voucherType?: 'TRANSFER_IN';
    linkSrcDocId: string;
    linkSrcAccYear: string;
}
export declare class SaveStockTransferReceiveDto {
    header: SaveStockTransferReceiveHeaderDto;
    lines: SaveStockVoucherItemDto[];
}
