import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
export declare class SaveStockTransferHeaderDto extends SaveStockVoucherHeaderDto {
    voucherType?: 'TRANSFER_OUT';
}
export declare class SaveStockTransferDto {
    header: SaveStockTransferHeaderDto;
    lines: SaveStockVoucherItemDto[];
}
