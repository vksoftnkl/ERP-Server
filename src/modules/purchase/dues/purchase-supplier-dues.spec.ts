import { HttpException } from '@nestjs/common';
import { PurchaseSupplierDuesController, PurchaseSupplierDuesService, SUPPLIER_DUES_MENU_ID } from './purchase-supplier-dues';

/**
 * Supplier dues rights sit on menu 297 (View / Post / Cancel, SDU_RIGHT_*), and settle-undo dispatches by the
 * pur_claim_settlement row: a shortage-claim settlement (pcs_shortage_close_id set) goes to the shortage service.
 */
const USER = '01a00000-0000-7000-8000-000000000001';

type Flags = Partial<Record<'um_can_view' | 'um_can_post' | 'um_can_cancel', boolean>>;
function rightsPrisma(byMenu: Record<number, Flags>) {
  const calls: number[] = [];
  const prisma = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (strings.join('?').includes('public.user_menus')) {
        const menu = values[1] as number;
        calls.push(menu);
        return byMenu[menu] ? [byMenu[menu]] : [];
      }
      return [];
    }),
  };
  return { prisma, calls };
}
const ctx = { getUserId: () => USER };
const codeOf = async (p: Promise<unknown>) => {
  try { await p; return 'NO_THROW'; } catch (e) {
    const r = (e as HttpException).getResponse() as { errors?: { code: string }[] };
    return `${(e as HttpException).getStatus()} ${r.errors?.[0]?.code}`;
  }
};

describe('Supplier dues rights (menu 297)', () => {
  const service = {
    open: jest.fn(async () => ({ claims: [], shortages: [] })),
    settle: jest.fn(async () => ({ steps: [{}] })),
    settleUndo: jest.fn(async () => ({ source: 'SHORTAGE' })),
  } as unknown as PurchaseSupplierDuesService;

  it('the menu is 297', () => expect(SUPPLIER_DUES_MENU_ID).toBe(297));

  it('no grant on 297: open / dryRun / settle / undo are 403 with SDU_RIGHT_* codes, and nothing runs', async () => {
    const { prisma, calls } = rightsPrisma({ 25: { um_can_view: true, um_can_post: true, um_can_cancel: true }, 195: { um_can_view: true, um_can_post: true, um_can_cancel: true } });
    const c = new PurchaseSupplierDuesController(service, prisma as never, ctx as never);
    expect(await codeOf(c.open({ companyId: 'c', branchId: 'b' } as never))).toBe('403 SDU_RIGHT_VIEW');
    expect(await codeOf(c.settle({ rows: [{ shortageCloseId: 'x', accYear: 'y' }], dryRun: true } as never))).toBe('403 SDU_RIGHT_VIEW');
    expect(await codeOf(c.settle({ rows: [{ returnItemId: 'x', accYear: 'y' }] } as never))).toBe('403 SDU_RIGHT_POST');
    expect(await codeOf(c.settleUndo({ settlementId: 's', accYear: 'y', reason: 'r' } as never))).toBe('403 SDU_RIGHT_CANCEL');
    expect(new Set(calls)).toEqual(new Set([297]));          // the old menus 25 / 195 are no longer read
    expect(service.open).not.toHaveBeenCalled();
    expect(service.settle).not.toHaveBeenCalled();
    expect(service.settleUndo).not.toHaveBeenCalled();
  });

  it('View only on 297: open and dryRun pass, posting and undo do not', async () => {
    const { prisma } = rightsPrisma({ 297: { um_can_view: true } });
    const c = new PurchaseSupplierDuesController(service, prisma as never, ctx as never);
    const open = await c.open({ companyId: 'c', branchId: 'b' } as never);
    expect(open.success).toBe(true);
    expect(service.open).toHaveBeenCalledWith(expect.anything(), { claims: true, shortages: true });
    expect(await codeOf(c.settle({ rows: [{ shortageCloseId: 'x', accYear: 'y' }], dryRun: true } as never))).toBe('NO_THROW');
    expect(await codeOf(c.settle({ rows: [{ shortageCloseId: 'x', accYear: 'y' }] } as never))).toBe('403 SDU_RIGHT_POST');
    expect(await codeOf(c.settleUndo({ settlementId: 's', accYear: 'y', reason: 'r' } as never))).toBe('403 SDU_RIGHT_CANCEL');
  });

  it('Post + Cancel on 297: settle and undo run', async () => {
    const { prisma } = rightsPrisma({ 297: { um_can_view: true, um_can_post: true, um_can_cancel: true } });
    const c = new PurchaseSupplierDuesController(service, prisma as never, ctx as never);
    expect(await codeOf(c.settle({ rows: [{ returnItemId: 'x', accYear: 'y' }] } as never))).toBe('NO_THROW');
    expect(await codeOf(c.settleUndo({ settlementId: 's', accYear: 'y', reason: 'r' } as never))).toBe('NO_THROW');
  });
});

describe('settle-undo dispatch by the pur_claim_settlement row', () => {
  const make = (kind: string | null) => {
    const prisma = {
      $queryRaw: jest.fn(async () => (kind ? [{ k: kind }] : [])),
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn({})),
    };
    const returns = { settleUndo: jest.fn(async () => ({ reversalId: 'r1', returnItemId: 'ri' })) };
    const shortages = { settleClaimUndoIn: jest.fn(async () => ({ reversalId: 'r2', shortageCloseId: 'sc' })) };
    const svc = new PurchaseSupplierDuesService(prisma as never, ctx as never, returns as never, shortages as never);
    return { svc, returns, shortages };
  };
  it('a shortage-claim row goes to the shortage service', async () => {
    const { svc, returns, shortages } = make('SHORTAGE');
    expect(await svc.settleUndo({ settlementId: 's', accYear: 'y', reason: 'r' })).toEqual({ source: 'SHORTAGE', returnItemId: null, reversalId: 'r2', shortageCloseId: 'sc' });
    expect(shortages.settleClaimUndoIn).toHaveBeenCalled();
    expect(returns.settleUndo).not.toHaveBeenCalled();
  });
  it('a return-claim row goes to the return service', async () => {
    const { svc, returns, shortages } = make('RETURN');
    expect(await svc.settleUndo({ settlementId: 's', accYear: 'y', reason: 'r' })).toEqual({ source: 'RETURN', shortageCloseId: null, reversalId: 'r1', returnItemId: 'ri' });
    expect(returns.settleUndo).toHaveBeenCalled();
    expect(shortages.settleClaimUndoIn).not.toHaveBeenCalled();
  });
  it('an unknown id is 404 PUR_NOT_FOUND', async () => {
    const { svc } = make(null);
    expect(await codeOf(svc.settleUndo({ settlementId: 's', accYear: 'y', reason: 'r' }))).toBe('404 PUR_NOT_FOUND');
  });
});

describe('Supplier dues totals: GST held (review 2026-10-29 item 3)', () => {
  it('gstHeld sums only rows whose GST is parked as pending; an old REPLACE (GST still claimed) keeps its row openGst but adds nothing', async () => {
    const shortages = {
      duesClaims: jest.fn(async () => []),
      open: jest.fn(async () => [
        { status: 'OPEN', openQty: '2', openValue: '100.00', openGst: '18.00', gstPending: true },    // SHORT_BILL
        { status: 'PART', openQty: '1', openValue: '50.00', openGst: '9.00', gstPending: true },      // REPLACE since 10-29
        { status: 'OPEN', openQty: '3', openValue: '200.00', openGst: '36.00', gstPending: false },   // REPLACE before 10-29
        { status: 'CLOSED', openQty: '0', openValue: '0.00', openGst: '5.00', gstPending: true },
      ]),
    };
    const svc = new PurchaseSupplierDuesService({} as never, ctx as never, { duesClaims: jest.fn(async () => []) } as never, shortages as never);
    const out = (await svc.open({ companyId: 'c', branchId: 'b' } as never, { claims: true, shortages: true })) as unknown as {
      totals: { shortages: { rows: number; openValue: string; gstHeld: string } }; shortages: { openGst: string }[] };
    expect(out.totals.shortages.rows).toBe(3);
    expect(out.totals.shortages.openValue).toBe('350.00');
    expect(out.totals.shortages.gstHeld).toBe('27.00');
    expect(out.shortages[2].openGst).toBe('36.00');              // the row keeps its own openGst
  });
});
