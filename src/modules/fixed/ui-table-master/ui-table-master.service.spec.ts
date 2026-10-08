import { PrismaService } from '../../../database/prisma/prisma.service';
import { UiTableMasterService } from './ui-table-master.service';

/** Any id the mock recognises; the column is looked up before it is written. */
const COLUMN_ID = '4217';

type PrismaMock = {
  uitableColumns: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe('UiTableMasterService.updateColumnWidths', () => {
  let prisma: PrismaMock;
  let service: UiTableMasterService;

  beforeEach(() => {
    prisma = {
      uitableColumns: {
        findFirst: jest.fn().mockResolvedValue({ uiTblClmId: BigInt(COLUMN_ID) }),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    service = new UiTableMasterService(
      prisma as unknown as PrismaService,
      { logEntityChange: jest.fn().mockResolvedValue(undefined) } as never,
      { getUserId: jest.fn().mockReturnValue(null) } as never,
    );
  });

  const writtenData = () =>
    (prisma.uitableColumns.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;

  it('stores the pixel width a dragged column was left at, and nothing else', async () => {
    // What the grids send: the width the browser laid the column out at, alone.
    await service.updateColumnWidths({
      columns: [{ uiTblClmId: COLUMN_ID, uiTblClmPx: '212px' }],
    });

    const data = writtenData();
    expect(data.uiTblClmPx).toBe('212px');
    expect(data).not.toHaveProperty('uiTblClmColumnWidth');
  });

  it('leaves a stored pixel width alone when the caller sends the fraction only', async () => {
    // The desktop client posts `uiTblClmColumnWidth` by itself; that must not
    // wipe the exact width the browser saved.
    await service.updateColumnWidths({
      columns: [{ uiTblClmId: COLUMN_ID, uiTblClmColumnWidth: 11.5 }],
    });

    const data = writtenData();
    expect(data.uiTblClmColumnWidth).toBe(11.5);
    expect(data).not.toHaveProperty('uiTblClmPx');
  });

  it('writes both widths when a caller sends both', async () => {
    await service.updateColumnWidths({
      columns: [{ uiTblClmId: COLUMN_ID, uiTblClmColumnWidth: 11.5, uiTblClmPx: '212px' }],
    });

    const data = writtenData();
    expect(data.uiTblClmColumnWidth).toBe(11.5);
    expect(data.uiTblClmPx).toBe('212px');
  });
});
