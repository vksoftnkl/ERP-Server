import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { SaveStockVoucherItemDto } from '../../stock-voucher/dto/save-stock-voucher-item.dto';
import { SaveStockTransferDto, SaveStockTransferHeaderDto } from './save-stock-transfer.dto';
import {
  SaveStockTransferReceiveDto,
  SaveStockTransferReceiveHeaderDto,
} from './save-stock-transfer-receive.dto';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_A = '01000000-0000-7000-8000-0000000000b1';
const BRANCH_B = '01000000-0000-7000-8000-0000000000b2';
const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
const GD_MAIN = '01000000-0000-7000-8000-0000000000e1';
const GD_COLD = '01000000-0000-7000-8000-0000000000e2';
const MILK = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const LOT_MILK = '01000000-0000-7000-8000-000000000021';
const OUT_ID = '01000000-0000-7000-8000-0000000000f1';

const HEADER = {
  accYear: '2026-2027',
  companyId: COMPANY_ID,
  branchId: BRANCH_A,
  deviceId: DEVICE_ID,
  docDate: '2026-04-01',
  fromGodownId: GD_MAIN,
  toGodownId: GD_COLD,
};
const LINE = {
  lineNo: 1,
  itemId: MILK,
  uomId: UOM_ID,
  baseUomId: UOM_ID,
  toBaseFactor: 1,
  godownId: GD_MAIN,
  lotId: LOT_MILK,
  qty: 20,
  baseQty: 20,
};

/** Every refused field path, nested ones as `header.x` / `lines.0.x`. */
const refused = (errors: ValidationError[], parent = ''): string[] =>
  errors.flatMap((error) => {
    const path = parent ? `${parent}.${error.property}` : error.property;
    return [...(error.constraints ? [path] : []), ...refused(error.children ?? [], path)];
  });

describe('SaveStockTransferDto', () => {
  const parse = (header: object = {}, lines: unknown = [LINE]) =>
    plainToInstance(SaveStockTransferDto, { header: { ...HEADER, ...header }, lines });

  it('builds the header and every line as their own DTOs, and accepts a despatch', () => {
    const dto = parse();

    expect(dto.header).toBeInstanceOf(SaveStockTransferHeaderDto);
    expect(dto.lines[0]).toBeInstanceOf(SaveStockVoucherItemDto);
    expect(refused(validateSync(dto))).toEqual([]);
  });

  it('takes TRANSFER_OUT as the voucher type, and nothing else', () => {
    expect(refused(validateSync(parse({ voucherType: 'TRANSFER_OUT' })))).toEqual([]);
    expect(refused(validateSync(parse({ voucherType: 'OPENING' })))).toEqual([
      'header.voucherType',
    ]);
  });

  it('refuses lines that are not a list, and more than 500 of them', () => {
    expect(refused(validateSync(parse({}, 'all of it')))).toContain('lines');
    expect(
      refused(
        validateSync(
          parse(
            {},
            Array.from({ length: 501 }, (_, i) => ({ ...LINE, lineNo: i + 1 })),
          ),
        ),
      ),
    ).toEqual(['lines']);
  });

  it('checks each line against the shared line rules', () => {
    expect(refused(validateSync(parse({}, [{ ...LINE, itemId: 'milk' }])))).toEqual([
      'lines.0.itemId',
    ]);
  });
});

describe('SaveStockTransferReceiveDto', () => {
  const RECEIPT_HEADER = {
    ...HEADER,
    branchId: BRANCH_B,
    linkSrcDocId: OUT_ID,
    linkSrcAccYear: '2026-2027',
  };
  const parse = (header: object = {}, lines: unknown = [LINE]) =>
    plainToInstance(SaveStockTransferReceiveDto, {
      header: { ...RECEIPT_HEADER, ...header },
      lines,
    });

  it('builds the header and every line as their own DTOs, and accepts a receipt', () => {
    const dto = parse();

    expect(dto.header).toBeInstanceOf(SaveStockTransferReceiveHeaderDto);
    expect(dto.lines[0]).toBeInstanceOf(SaveStockVoucherItemDto);
    expect(refused(validateSync(dto))).toEqual([]);
  });

  it('takes TRANSFER_IN as the voucher type, and nothing else', () => {
    expect(refused(validateSync(parse({ voucherType: 'TRANSFER_IN' })))).toEqual([]);
    expect(refused(validateSync(parse({ voucherType: 'TRANSFER_OUT' })))).toEqual([
      'header.voucherType',
    ]);
  });

  it('refuses a despatch link that is not a uuid, and a despatch year that is not YYYY-YYYY', () => {
    expect(refused(validateSync(parse({ linkSrcDocId: 'TRF-2', linkSrcAccYear: '2026' })))).toEqual(
      ['header.linkSrcDocId', 'header.linkSrcAccYear'],
    );
  });

  it('refuses more than 500 lines', () => {
    expect(
      refused(
        validateSync(
          parse(
            {},
            Array.from({ length: 501 }, (_, i) => ({ ...LINE, lineNo: i + 1 })),
          ),
        ),
      ),
    ).toEqual(['lines']);
  });
});
