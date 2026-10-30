import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import type { TxnAdjacentQueryDto } from './dto/txn-adjacent-query.dto';
import { TXN_DOC_REGISTRY, TXN_DOC_TYPES } from './txn-adjacent.registry';
import { TxnAdjacentService } from './txn-adjacent.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46d002';
const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46d003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46d004';
const NEXT_ID = '019c6f6c-be87-7a11-8905-36092c46d005';
const ACC_YEAR = '2026-2027';

const VIEW_ROW = { um_can_view: true };
const FOUND = [{ found: 1 }];
const nextRow = (overrides: Record<string, unknown> = {}) => ({
  doc_id: NEXT_ID,
  company_id: COMPANY_ID,
  branch_id: BRANCH_ID,
  // bpchar pads the 9-character year.
  acc_year: `${ACC_YEAR} `,
  type_code: 'OPENING',
  refno: 'OS/0002',
  doc_date: '2026-10-23',
  status: 'POSTED',
  ...overrides,
});

/** The SQL text and bound values of the nth $queryRaw call. */
const queryOf = (mock: jest.Mock, call: number): Prisma.Sql => {
  const [strings, ...values] = mock.mock.calls[call] as [TemplateStringsArray, ...unknown[]];
  return Prisma.sql(strings, ...values);
};
const squash = (sql: Prisma.Sql) => sql.text.replace(/\s+/g, ' ');

const query = (overrides: Partial<TxnAdjacentQueryDto> = {}): TxnAdjacentQueryDto => ({
  docType: 'OPENING_STOCK',
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: ACC_YEAR,
  direction: 'next',
  ...overrides,
});

/** The first error detail of a thrown house body. */
async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    const body = (
      e as { getResponse(): { errors: { code: string; field: string }[] } }
    ).getResponse();
    return { error: e, detail: body.errors[0] };
  }
  throw new Error('expected a refusal');
}

describe('TxnAdjacentService', () => {
  let service: TxnAdjacentService;
  let queryRaw: jest.Mock;
  let userId: string | null;

  beforeEach(() => {
    queryRaw = jest.fn().mockResolvedValue([]);
    userId = USER_ID;
    service = new TxnAdjacentService(
      { $queryRaw: queryRaw } as unknown as PrismaService,
      { getUserId: () => userId } as unknown as RequestContextService,
    );
  });

  describe('a fixed-menu docType', () => {
    it('reads VIEW on its menu, checks the doc on screen under all four keys, then walks', async () => {
      queryRaw
        .mockResolvedValueOnce([VIEW_ROW])
        .mockResolvedValueOnce(FOUND)
        .mockResolvedValueOnce([nextRow()]);

      const out = await service.adjacent(query({ docId: DOC_ID }));

      expect(queryOf(queryRaw, 0).values).toEqual([USER_ID, 44]);
      const exists = queryOf(queryRaw, 1);
      expect(squash(exists)).toContain('FROM stock.stock_voucher h');
      expect(squash(exists)).toContain(
        'AND h.svh_is_deleted = false AND h.svh_voucher_type IN ($5)',
      );
      expect(exists.values).toEqual([DOC_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR, 'OPENING']);
      expect(out).toEqual({
        docType: 'OPENING_STOCK',
        direction: 'next',
        fromDocId: DOC_ID,
        doc: {
          docId: NEXT_ID,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: ACC_YEAR,
          typeCode: 'OPENING',
          refno: 'OS/0002',
          date: '2026-10-23',
          status: 'POSTED',
        },
      });
    });

    // Notes 152: svh_slno is counted per device, so two PCs' documents would
    // interleave by their own counters; created_on follows the branch refno.
    it('next is > and ASC on (date, created_on, id) — no per-device serial — bounded by the doc on screen', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]).mockResolvedValueOnce(FOUND);

      await service.adjacent(query({ docId: DOC_ID }));

      const walk = squash(queryOf(queryRaw, 2));
      expect(walk).toContain(
        'AND (h.svh_doc_date,h.svh_created_on,h.svh_id) > ' +
          '(SELECT c.svh_doc_date,c.svh_created_on,c.svh_id FROM stock.stock_voucher c',
      );
      expect(walk).toContain(
        'ORDER BY h.svh_doc_date ASC,h.svh_created_on ASC,h.svh_id ASC LIMIT 1',
      );
      expect(walk).not.toContain('svh_slno');
      expect(walk).not.toContain('COALESCE');
    });

    it('prev is < and DESC', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]).mockResolvedValueOnce(FOUND);

      await service.adjacent(query({ docId: DOC_ID, direction: 'prev' }));

      const walk = squash(queryOf(queryRaw, 2));
      expect(walk).toContain('h.svh_id) < (SELECT');
      expect(walk).toContain('h.svh_id DESC LIMIT 1');
    });

    it('an empty screen skips the lookup and the bound: the first row in walk order answers', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]);

      const out = await service.adjacent(query({ direction: 'prev' }));

      expect(queryRaw).toHaveBeenCalledTimes(2);
      const walk = queryOf(queryRaw, 1);
      expect(squash(walk)).not.toContain('SELECT c.');
      expect(walk.values).toEqual([COMPANY_ID, BRANCH_ID, ACC_YEAR, 'OPENING']);
      expect(out).toEqual({
        docType: 'OPENING_STOCK',
        direction: 'prev',
        fromDocId: null,
        doc: null,
      });
    });

    it('binds only the filters that were set', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]);

      await service.adjacent(
        query({ status: 'CANCELLED', fromDate: '2026-10-01', toDate: '2026-10-31' }),
      );

      const walk = queryOf(queryRaw, 1);
      expect(squash(walk)).toContain(
        'AND h.svh_status = $5 AND h.svh_doc_date >= $6::date AND h.svh_doc_date <= $7::date',
      );
      // No `$x IS NULL OR` form: it goes slow on a generic plan.
      expect(walk.text).not.toContain('IS NULL OR');
      expect(walk.values).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        ACC_YEAR,
        'OPENING',
        'CANCELLED',
        '2026-10-01',
        '2026-10-31',
      ]);
    });

    it('403 TXN_RIGHT_VIEW without um_can_view on the menu, before any read of the documents', async () => {
      const { error, detail } = await refusal(service.adjacent(query({ docType: 'SALE_BILL' })));

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(detail.code).toBe('TXN_RIGHT_VIEW');
      expect(queryOf(queryRaw, 0).values).toEqual([USER_ID, 12]);
      expect(queryRaw).toHaveBeenCalledTimes(1);
    });

    it('403 with no user in the request context, without reading user_menus', async () => {
      userId = null;

      const { error } = await refusal(service.adjacent(query()));

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(queryRaw).not.toHaveBeenCalled();
    });

    it('404 TXN_DOC_NOT_FOUND when the doc on screen is not there under its four keys', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]).mockResolvedValueOnce([]);

      const { error, detail } = await refusal(service.adjacent(query({ docId: DOC_ID })));

      expect(error).toBeInstanceOf(NotFoundException);
      expect(detail).toMatchObject({ code: 'TXN_DOC_NOT_FOUND', field: 'docId' });
      expect(queryRaw).toHaveBeenCalledTimes(2);
    });

    it('400 TXN_STATUS_NOT_IN_DOC for a status the docType does not have', async () => {
      const { error, detail } = await refusal(service.adjacent(query({ status: 'CONFIRMED' })));

      expect(error).toBeInstanceOf(BadRequestException);
      expect(detail).toMatchObject({ code: 'TXN_STATUS_NOT_IN_DOC', field: 'status' });
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('STOCK_ADJUSTMENT', () => {
    it('walks the four kinds, never a sale bill’s stock movement', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]);

      await service.adjacent(query({ docType: 'STOCK_ADJUSTMENT' }));

      const walk = queryOf(queryRaw, 1);
      expect(squash(walk)).toContain(
        "AND h.svh_voucher_type IN ($4,$5,$6,$7) AND COALESCE(h.svh_link_src_module, 'STOCK') = 'STOCK'",
      );
      expect(walk.values.slice(3)).toEqual(['ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF']);
    });

    it('typeCode narrows to one kind', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]);

      await service.adjacent(query({ docType: 'STOCK_ADJUSTMENT', typeCode: 'ISSUE' }));

      const walk = queryOf(queryRaw, 1);
      expect(squash(walk)).toContain('AND h.svh_voucher_type = $8');
      expect(walk.values[7]).toBe('ISSUE');
    });

    it('400 TXN_TYPE_NOT_IN_DOC for a typeCode outside its kinds', async () => {
      const { error, detail } = await refusal(
        service.adjacent(query({ docType: 'STOCK_ADJUSTMENT', typeCode: 'OPENING' })),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect(detail).toMatchObject({ code: 'TXN_TYPE_NOT_IN_DOC', field: 'typeCode' });
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('SALE_BILL', () => {
    // Notes 152: a POS bill is numbered on the device's own series, a
    // wholesale bill on the branch's, so the serial cannot order a date's bills.
    it('walks by (date, created_on, id): the bill serial is not branch-wide', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]).mockResolvedValueOnce(FOUND);

      await service.adjacent(query({ docType: 'SALE_BILL', docId: DOC_ID }));

      const walk = squash(queryOf(queryRaw, 2));
      expect(walk).toContain(
        'AND (h.sb_bill_date,h.sb_created_on,h.sb_id) > ' +
          '(SELECT c.sb_bill_date,c.sb_created_on,c.sb_id FROM sales.sale_bill c',
      );
      expect(walk).not.toContain('sb_bill_slno');
      // Every row of sale_bill is a bill: no type set to filter on.
      expect(walk).not.toContain('h.sb_doc_type IN');
    });

    it('typeCode matches the bill’s own doc type', async () => {
      queryRaw
        .mockResolvedValueOnce([VIEW_ROW])
        .mockResolvedValueOnce([
          nextRow({ type_code: 'TAX_INVOICE', refno: null, status: 'DRAFT' }),
        ]);

      const out = await service.adjacent(query({ docType: 'SALE_BILL', typeCode: 'TAX_INVOICE' }));

      expect(squash(queryOf(queryRaw, 1))).toContain('AND h.sb_doc_type = $4');
      expect(out.doc).toMatchObject({ typeCode: 'TAX_INVOICE', refno: null, status: 'DRAFT' });
    });
  });

  describe('RECEIPT / PAYMENT', () => {
    it('walk their one type on their screen’s menu, never a PDC child or a reversal', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]);

      await service.adjacent(query({ docType: 'PAYMENT' }));

      expect(queryOf(queryRaw, 0).values).toEqual([USER_ID, 100]);
      const walk = queryOf(queryRaw, 1);
      expect(squash(walk)).toContain(
        'AND vt.vchr_type_code IN ($4) AND h.avh_against_voucher_id IS NULL',
      );
      expect(walk.values[3]).toBe('Pmt');
      // The company-wide voucher serial stays in the key, a draft at the NEW end.
      expect(squash(walk)).toContain(
        'ORDER BY h.avh_voucher_date ASC,COALESCE(h.avh_voucher_slno, 9223372036854775807) ASC,' +
          'h.avh_created_on ASC,h.avh_voucher_id ASC LIMIT 1',
      );
      expect(squash(walk)).not.toContain('user_menus');
    });
  });

  describe('a branch-wide sales serial', () => {
    it('stays in the key between the date and created_on (sales order)', async () => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]).mockResolvedValueOnce(FOUND);

      await service.adjacent(query({ docType: 'SALE_ORDER', docId: DOC_ID, direction: 'prev' }));

      const walk = squash(queryOf(queryRaw, 2));
      expect(walk).toContain(
        'AND (h.so_order_date,h.so_order_slno,h.so_created_on,h.so_id) < ' +
          '(SELECT c.so_order_date,c.so_order_slno,c.so_created_on,c.so_id FROM sales.sale_order c',
      );
      expect(walk).not.toContain('COALESCE');
    });
  });

  describe('VOUCHER', () => {
    it('reads each row on its own type’s menu and sorts a draft at the OLD end', async () => {
      const out = await service.adjacent(query({ docType: 'VOUCHER', direction: 'prev' }));

      expect(queryRaw).toHaveBeenCalledTimes(1);
      const walk = queryOf(queryRaw, 0);
      expect(squash(walk)).toContain(
        'JOIN public.user_menus um ON um.um_menu_id = vt.vchr_menu_id AND um.um_user_id = $1::uuid',
      );
      expect(squash(walk)).toContain('AND vt.vchr_in_register = true');
      expect(squash(walk)).toContain('COALESCE(h.avh_voucher_slno, 0) DESC');
      expect(walk.values[0]).toBe(USER_ID);
      expect(out.doc).toBeNull();
    });

    it('a typeCode must be an active register type, viewed on ITS menu', async () => {
      queryRaw.mockResolvedValueOnce([{ vchr_menu_id: 103 }]).mockResolvedValueOnce([VIEW_ROW]);

      await service.adjacent(query({ docType: 'VOUCHER', typeCode: 'Jrl' }));

      expect(queryOf(queryRaw, 0).values).toEqual(['Jrl']);
      expect(queryOf(queryRaw, 1).values).toEqual([USER_ID, 103]);
      expect(squash(queryOf(queryRaw, 2))).toContain('AND vt.vchr_type_code = $5');
    });

    it('400 TXN_TYPE_NOT_IN_DOC for a type outside the register', async () => {
      queryRaw.mockResolvedValueOnce([]);

      const { error, detail } = await refusal(
        service.adjacent(query({ docType: 'VOUCHER', typeCode: 'Rev' })),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect(detail.code).toBe('TXN_TYPE_NOT_IN_DOC');
    });

    it('403 TXN_RIGHT_VIEW when the type’s menu is not viewable', async () => {
      queryRaw.mockResolvedValueOnce([{ vchr_menu_id: 104 }]).mockResolvedValueOnce([]);

      const { error, detail } = await refusal(
        service.adjacent(query({ docType: 'VOUCHER', typeCode: 'Con' })),
      );

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(detail.code).toBe('TXN_RIGHT_VIEW');
    });
  });

  it.each(TXN_DOC_TYPES.filter((t) => TXN_DOC_REGISTRY[t].menu !== 'VOUCHER_TYPE'))(
    '%s builds a walk over its own table',
    async (docType) => {
      queryRaw.mockResolvedValueOnce([VIEW_ROW]).mockResolvedValueOnce(FOUND);

      await service.adjacent(query({ docType, docId: DOC_ID }));

      const spec = TXN_DOC_REGISTRY[docType];
      const walk = squash(queryOf(queryRaw, 2));
      expect(walk).toContain(`FROM ${spec.table} h`);
      expect(walk).toContain(`FROM ${spec.table} c WHERE c.${spec.id} = `);
      expect(walk).toContain(`h.${spec.deleted} = false`);
    },
  );
});
