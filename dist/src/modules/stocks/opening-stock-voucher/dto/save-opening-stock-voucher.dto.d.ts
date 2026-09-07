import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockVoucherHeaderDto } from '../../stock-voucher/dto/save-stock-voucher.dto';
export declare class SaveOpeningStockVoucherHeaderDto extends SaveStockVoucherHeaderDto {
    voucherType?: 'OPENING';
}
export declare class SaveOpeningStockVoucherDto {
    header: SaveOpeningStockVoucherHeaderDto;
    lines: SaveStockVoucherItemDto[];
}
