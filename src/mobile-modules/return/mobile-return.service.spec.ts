import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MobileReturnService } from './mobile-return.service';
import type { CreateMobileReturnDto } from './dto/mobile-return.dto';

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const CUSTOMER = '01a0aa0b-31c3-7602-9209-8cf164d4b6c8';
const OTHER_CUSTOMER = '019f1dc6-7d53-7a5d-913b-66d57b891257';
const DEV_ID = '01a1e472-f29f-7950-a396-27d8dc768353';
const LOGIN = '019e441b-6e48-7918-b246-b857ffb35db1';
const CLIENT_UUID = '01a1f8e0-b7d9-70e9-a7fc-1e9c3eb9eaff';
const V4_UUID = '3b241101-e2bb-4255-8caf-4136c566a962';
const BILL = '01a1f293-eb8e-73f9-aeec-55e5c6a96d7f';
const BILL_LINE = '01a1f293-eb9b-71b8-86eb-97c3abfa7620';
const ITEM = '019dcda7-6e4b-7519-8f59-e3ccfe701381';
const UNIT = '019dcda7-6e83-7a69-b02a-461064a49e1b';
const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const DEFAULT_GODOWN = '019c9935-79f4-772b-8666-2b46b9fc82cc';
const REASON = '01a1d507-031c-7e83-81e2-bab720a51dab';
const ABL = '01a1f293-ec9c-7844-bfa3-14d2efbec239';

const dto = (over: Partial<CreateMobileReturnDto> = {}): CreateMobileReturnDto => ({
  srClientUuid: CLIENT_UUID,
  deviceUid: 'phone-1',
  srCompanyId: COMPANY,
  srBranchId: BRANCH,
  srCustId: CUSTOMER,
  srIsAgainstBill: true,
  srBillId: BILL,
  srBillAccYear: '2026-2027',
  srReasonId: REASON,
  srSettleMode: 'ADJUST',
  srMobileRefno: 'R3F9A/2627/00005',
  lines: [
    {
      sriLineNo: 1,
      sriBillItemId: BILL_LINE,
      sriBillAccYear: '2026-2027',
      sriItemId: ITEM,
      sriItemUnitId: UNIT,
      sriReturnQty: 1,
      sriCondition: 'RESTOCK',
    },
  ],
  ...over,
});

const returnRow = (over: Record<string, unknown> = {}) => ({
  srId: CLIENT_UUID,
  srAccYear: '2026-2027',
  srCompanyId: COMPANY,
  srBranchId: BRANCH,
  srCustId: CUSTOMER,
  srClientUuid: CLIENT_UUID,
  srReturnRefno: 'SRT/2026-2027/D15/00001',
  srMobileRefno: 'R3F9A/2627/00005',
  srStatus: 'POSTED',
  srIsDeleted: false,
  srReturnDate: '2026-11-20',
  srReturnAmt: new Prisma.Decimal('86.90'),
  srTaxAmt: new Prisma.Decimal('4.14'),
  srRoundOff: new Prisma.Decimal('0.00'),
  srCashDisc: new Prisma.Decimal('0'),
  srSettleMode: 'ADJUST',
  srCreditAmt: new Prisma.Decimal('86.90'),
  srSettleStatus: 'CREDITED',
  ...over,
});

interface Script {
  /** The row a client-uuid look-up finds (null: a first upload). */
  stored: Record<string, unknown> | null;
  /** The row a by-keys read finds after the save / post. */
  saved?: Record<string, unknown>;
  pendingApprovals?: number;
  billCustomer?: string;
  noGodown?: boolean;
}

/** A transaction that answers each raw read by what it reads. */
function scriptedTx(script: Script) {
  const executed: string[] = [];
  const sqlOf = (strings: TemplateStringsArray) => strings.join('?');
  const tx = {
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = sqlOf(strings);
      if (sql.includes('pg_advisory_xact_lock')) return [{ locked: 1 }];
      if (sql.includes('FROM sales.sale_return r')) {
        const where = values[0] as Prisma.Sql;
        const byUuid = where.strings.join('?').includes('sr_client_uuid');
        if (byUuid) return script.stored ? [script.stored] : [];
        return [script.saved ?? returnRow()];
      }
      if (sql.includes('FROM public.companys'))
        return [{ compId: COMPANY, compGstApplicable: true }];
      if (sql.includes('FROM fixed.device_master'))
        return [
          {
            devId: DEV_ID,
            devCode: 'D15',
            devCompanyId: COMPANY,
            devBranchId: BRANCH,
            devIsActive: true,
            devIsBlocked: false,
            devBlockReason: null,
          },
        ];
      if (sql.includes('br_default_godown_id')) return [{ godownId: DEFAULT_GODOWN }];
      if (sql.includes('FROM inventory.godown_locations g'))
        return script.noGodown ? [] : [{ id: GODOWN }];
      if (sql.includes('FROM public.branch_master')) return [{ brId: BRANCH }];
      if (sql.includes('CURRENT_DATE::text')) return [{ today: '2026-11-20' }];
      if (sql.includes('FROM public.fiscal_years')) return [{ name: '2026-2027' }];
      if (sql.includes('count(*)::int AS n')) return [{ n: script.pendingApprovals ?? 0 }];
      if (sql.includes('FROM public.user_master'))
        return [{ userId: LOGIN, loginName: 'VKPOS', employeeId: null, employeeName: null }];
      if (sql.includes('FROM sales.customers'))
        return [{ cusId: CUSTOMER, cusName: 'Deepan', priceLevel: 2 }];
      if (sql.includes('FROM stock.stock_reason_master')) return [{ id: REASON }];
      if (sql.includes('FROM sales.sale_bill\n'))
        return [
          {
            sb_id: BILL,
            sb_acc_year: '2026-2027',
            sb_status: 'POSTED',
            sb_bill_refno: 'bil05088',
            sb_bill_date: '2026-11-19',
            sb_company_id: COMPANY,
            sb_branch_id: BRANCH,
            sb_cust_id: script.billCustomer ?? CUSTOMER,
            sb_salesman_id: ['01a00000-0000-7000-8000-00000000000a'],
            sb_loadman_id: [],
          },
        ];
      if (sql.includes('FROM sales.sale_bill_item bi'))
        return [{ id: BILL_LINE, itemId: ITEM, godownId: GODOWN }];
      if (sql.includes('FROM sales.sale_return_item i'))
        return [
          {
            sriLineNo: 1,
            sriSplitNo: 1,
            sriId: '01a1f8e0-b7d9-70e9-a7fc-000000000001',
            rateSource: 'BILL',
            taxableAmt: new Prisma.Decimal('82.76'),
            taxAmt: new Prisma.Decimal('4.14'),
            netAmt: new Prisma.Decimal('86.90'),
            bucket: 'SALEABLE',
          },
        ];
      if (sql.includes('FROM accounts.acc_bill_adjustment')) return [];
      if (sql.includes('FROM accounts.till_approval')) return [];
      if (sql.includes('FROM accounts.acc_bill_balance')) return [{ id: ABL, refno: 'bil05088' }];
      throw new Error(`unscripted read: ${sql}`);
    }),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray) => {
      executed.push(sqlOf(strings).trim().split(/\s+/).slice(0, 4).join(' '));
      return 1;
    }),
  };
  return { tx, executed };
}

function build(script: Script, post?: jest.Mock) {
  const { tx, executed } = scriptedTx(script);
  const order: string[] = [];
  const prisma = {
    $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      const out = await fn(tx);
      order.push('commit');
      return out;
    }),
    $queryRaw: tx.$queryRaw,
  };
  const returns = {
    saveInTx: jest.fn(async (_tx: unknown, body: { srId?: string }) => {
      order.push('save');
      return {
        id: body.srId ?? CLIENT_UUID,
        companyId: COMPANY,
        branchId: BRANCH,
        accYear: '2026-2027',
      };
    }),
    postInTx:
      post ??
      jest.fn(async () => {
        order.push('post');
        return { gdrId: null, einvoice: false, ewaybill: false };
      }),
    afterPostCommit: jest.fn(() => order.push('afterPostCommit')),
    fileGateRequestsInTx: jest.fn(async () => ['tap-1']),
    deleteInTx: jest.fn(async () => undefined),
  };
  const ctx = { getUserId: () => LOGIN };
  const salesContext = {};
  const service = new MobileReturnService(
    prisma as never,
    ctx as never,
    returns as never,
    salesContext as never,
  );
  return { service, returns, executed, order };
}

describe('MobileReturnService.create', () => {
  it('saves through the desktop without the save right, stamps the phone ids, posts behind a savepoint', async () => {
    const { service, returns, executed, order } = build({ stored: null });
    const out = await service.create(dto());
    expect(returns.saveInTx).toHaveBeenCalledTimes(1);
    const [, body, opts] = returns.saveInTx.mock.calls[0] as unknown as [
      unknown,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(opts).toEqual({ skipSaveRight: true, origin: 'PHONE' });
    expect(body).toMatchObject({
      srId: CLIENT_UUID,
      srCompanyId: COMPANY,
      srBranchId: BRANCH,
      srAccYear: '2026-2027',
      srCounterId: DEV_ID,
      srDeviceId: DEV_ID,
      srDeviceType: 'MOBILE',
      srUserId: LOGIN,
      srCustName: 'Deepan',
      srIsAgainstBill: true,
      srBillId: BILL,
      srReturnKind: 'RETURN',
      srSettleMode: 'ADJUST',
      srReturnDate: '2026-11-20',
      srSalesmanId: ['01a00000-0000-7000-8000-00000000000a'],
    });
    expect(body).not.toHaveProperty('srPriceLevel');
    expect((body.items as Record<string, unknown>[])[0]).toMatchObject({
      sriLineNo: 1,
      sriSplitNo: 1,
      sriBillItemId: BILL_LINE,
      sriGodownId: GODOWN,
      sriReturnQty: 1,
      sriFreeQty: 0,
      sriCondition: 'RESTOCK',
    });
    expect(executed).toEqual([
      'UPDATE sales.sale_return SET sr_client_uuid',
      'SAVEPOINT mobile_return_post',
      'RELEASE SAVEPOINT mobile_return_post',
    ]);
    expect(order).toEqual(['save', 'post', 'commit', 'afterPostCommit']);
    expect(out).toMatchObject({
      duplicate: false,
      status: 'POSTED',
      srId: CLIENT_UUID,
      srReturnAmt: '86.90',
      totals: {
        goods: '86.90',
        tax: '4.14',
        chargesNet: '0.00',
        roundOff: '0.00',
        creditNote: '86.90',
      },
      settlement: { mode: 'ADJUST', credited: '86.90', settleStatus: 'CREDITED', adjusted: [] },
      held: null,
      refusal: null,
      refusals: [],
      replanned: [],
    });
    expect(out.lines[0]).toEqual({
      sriLineNo: 1,
      sriSplitNo: 1,
      sriId: '01a1f8e0-b7d9-70e9-a7fc-000000000001',
      rateSource: 'BILL',
      taxableAmt: '82.76',
      taxAmt: '4.14',
      netAmt: '86.90',
      bucket: 'SALEABLE',
    });
  });

  it('lets the database mint a v7 srId when the phone sent a v4 uuid', async () => {
    const { service, returns } = build({ stored: null });
    await service.create(dto({ srClientUuid: V4_UUID }));
    const body = returns.saveInTx.mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty('srId');
  });

  it('a no-bill return: no bill keys, the branch default godown, the customer price level', async () => {
    const { service, returns } = build({ stored: null });
    await service.create(
      dto({
        srIsAgainstBill: false,
        srBillId: null,
        srBillAccYear: null,
        srSettleMode: 'ADVANCE',
        lines: [
          {
            sriLineNo: 1,
            sriItemId: ITEM,
            sriItemUnitId: UNIT,
            sriReturnQty: 2,
            sriCondition: 'DAMAGED',
            sriBatchNo: 'B1',
          },
        ],
      }),
    );
    const body = returns.saveInTx.mock.calls[0][1] as Record<string, unknown>;
    expect(body).toMatchObject({
      srIsAgainstBill: false,
      srBillId: null,
      srPriceLevel: 2,
      srSalesmanId: [],
    });
    expect((body.items as Record<string, unknown>[])[0]).toMatchObject({
      sriBillItemId: null,
      sriGodownId: DEFAULT_GODOWN,
      sriBatchNo: 'B1',
    });
  });

  it('godownId sends every line to that godown', async () => {
    const { service, returns } = build({ stored: null });
    await service.create(dto({ godownId: GODOWN }));
    const body = returns.saveInTx.mock.calls[0][1] as Record<string, unknown>;
    expect((body.items as Record<string, unknown>[])[0].sriGodownId).toBe(GODOWN);
  });

  it('a godownId that is not an active godown of the branch is 422 MOBILE_GODOWN_INVALID', async () => {
    const { service, returns } = build({ stored: null, noGodown: true });
    await expect(service.create(dto({ godownId: DEFAULT_GODOWN }))).rejects.toMatchObject({
      response: {
        errors: [expect.objectContaining({ code: 'MOBILE_GODOWN_INVALID', field: 'godownId' })],
      },
    });
    expect(returns.saveInTx).not.toHaveBeenCalled();
  });

  it('a refused post rolls back to the savepoint and is SENT_BACK with the refusal', async () => {
    const post = jest.fn(async () => {
      throw new UnprocessableEntityException({
        errors: [
          {
            code: 'SALES_RETURN_OVER_QTY',
            message: 'Line 1: too many',
            field: 'sriReturnQty',
            line: 1,
          },
        ],
      });
    });
    const { service, returns, executed, order } = build(
      {
        stored: null,
        saved: returnRow({ srStatus: 'DRAFT', srSettleStatus: null, srCreditAmt: null }),
      },
      post,
    );
    const out = await service.create(dto());
    expect(executed).toEqual([
      'UPDATE sales.sale_return SET sr_client_uuid',
      'SAVEPOINT mobile_return_post',
      'ROLLBACK TO SAVEPOINT mobile_return_post',
    ]);
    expect(order).toEqual(['save', 'commit', 'afterPostCommit']);
    expect(returns.afterPostCommit).toHaveBeenCalledWith(null);
    expect(returns.fileGateRequestsInTx).not.toHaveBeenCalled();
    expect(out).toMatchObject({
      status: 'SENT_BACK',
      srStatus: 'DRAFT',
      held: null,
      refusal: { code: 'SALES_RETURN_OVER_QTY', field: 'sriReturnQty', line: 1 },
    });
    expect(out.refusals).toHaveLength(1);
  });

  it('an approval the gate refuses is HELD and filed for the office inbox', async () => {
    const gate = { ask: { event: 'RETURN_NO_RECEIPT' }, rule: { tar_id: null } };
    const post = jest.fn(
      async (_tx: unknown, _keys: unknown, opts: { onGateRefused: (g: unknown) => void }) => {
        opts.onGateRefused(gate);
        throw new HttpException(
          {
            errors: [
              {
                code: 'TILL_APPROVAL_REQUIRED',
                message: 'needs approval',
                field: 'approvalIds',
                event: 'RETURN_NO_RECEIPT',
              },
            ],
          },
          428,
        );
      },
    );
    const { service, returns } = build(
      { stored: null, saved: returnRow({ srStatus: 'DRAFT' }) },
      post as jest.Mock,
    );
    const out = await service.create(dto());
    expect(out.status).toBe('HELD');
    expect(out.held).toMatchObject({ code: 'TILL_APPROVAL_REQUIRED', event: 'RETURN_NO_RECEIPT' });
    expect(returns.fileGateRequestsInTx).toHaveBeenCalledWith(
      expect.anything(),
      [gate],
      'Sent from the phone by VKPOS (R3F9A/2627/00005)',
    );
  });

  it('no Post right is HELD (nothing filed)', async () => {
    const post = jest.fn(async () => {
      throw new HttpException({ errors: [{ code: 'SALES_RIGHT_POST', message: 'no post' }] }, 403);
    });
    const { service, returns } = build(
      { stored: null, saved: returnRow({ srStatus: 'DRAFT' }) },
      post,
    );
    const out = await service.create(dto());
    expect(out.status).toBe('HELD');
    expect(out.held?.code).toBe('SALES_RIGHT_POST');
    expect(returns.fileGateRequestsInTx).not.toHaveBeenCalled();
  });

  it('a throw that is not a refusal fails the whole upload (no rollback to the savepoint)', async () => {
    const post = jest.fn(async () => {
      throw new Error('connection reset');
    });
    const { service, executed } = build({ stored: null }, post);
    await expect(service.create(dto())).rejects.toThrow('connection reset');
    expect(executed).not.toContain('ROLLBACK TO SAVEPOINT mobile_return_post');
  });

  it('passes the phone split to the post as a replanner, and reports what moved', async () => {
    const post = jest.fn(
      async (_tx: unknown, _keys: unknown, opts: { replanAdjust: (i: unknown) => unknown[] }) => {
        const asks = opts.replanAdjust({
          bills: [],
          adjustable: new Prisma.Decimal(86.9),
          thisSbId: BILL,
        });
        expect(asks).toEqual([]);
        return null;
      },
    );
    const { service } = build({ stored: null }, post as jest.Mock);
    const out = await service.create(
      dto({ adjustments: [{ billId: ABL, billAccYear: '2026-2027', amount: 50 }] }),
    );
    expect(out.replanned).toEqual([
      {
        billId: ABL,
        billAccYear: '2026-2027',
        refno: 'bil05088',
        from: '50.00',
        to: '0.00',
        reason: 'BILL_SETTLED',
      },
    ]);
  });

  it('no adjustments key: the desktop proposes the split (no replanner)', async () => {
    const { service, returns } = build({ stored: null });
    await service.create(dto());
    const opts = (returns.postInTx.mock.calls[0] as unknown[])[2] as { replanAdjust: unknown };
    expect(opts.replanAdjust).toBeNull();
  });
});

describe('MobileReturnService.create — resends', () => {
  it('a POSTED return is answered as it stands: duplicate, nothing saved or posted', async () => {
    const { service, returns, executed } = build({ stored: returnRow() });
    const out = await service.create(dto());
    expect(out).toMatchObject({ duplicate: true, status: 'POSTED', srStatus: 'POSTED' });
    expect(returns.saveInTx).not.toHaveBeenCalled();
    expect(returns.postInTx).not.toHaveBeenCalled();
    expect(executed).toEqual([]);
  });

  it('a DRAFT is saved again under its own keys and posted again', async () => {
    const { service, returns } = build({ stored: returnRow({ srStatus: 'DRAFT' }) });
    const out = await service.create(dto({ srBranchId: undefined }));
    expect(returns.saveInTx.mock.calls[0][1]).toMatchObject({
      srId: CLIENT_UUID,
      srBranchId: BRANCH,
    });
    expect(returns.postInTx).toHaveBeenCalledTimes(1);
    expect(out.duplicate).toBe(false);
  });

  it('a DRAFT waiting on an approval is not re-saved (D77), only posted again', async () => {
    const { service, returns } = build({
      stored: returnRow({ srStatus: 'DRAFT' }),
      pendingApprovals: 1,
    });
    await service.create(dto());
    expect(returns.saveInTx).not.toHaveBeenCalled();
    expect(returns.postInTx).toHaveBeenCalledTimes(1);
  });

  it('another customer on the same uuid is 409 MOBILE_CLIENT_UUID_REUSED', async () => {
    const { service } = build({ stored: returnRow({ srCustId: OTHER_CUSTOMER }) });
    await expect(service.create(dto())).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'MOBILE_CLIENT_UUID_REUSED' })] },
    });
  });

  it('a return the office deleted is 409 MOBILE_RETURN_DELETED', async () => {
    const { service } = build({ stored: returnRow({ srStatus: 'DRAFT', srIsDeleted: true }) });
    await expect(service.create(dto())).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'MOBILE_RETURN_DELETED' })] },
    });
  });

  it('a bill of another customer is 422 MOBILE_RETURN_BILL_OTHER_CUSTOMER, nothing saved', async () => {
    const { service, returns } = build({ stored: null, billCustomer: OTHER_CUSTOMER });
    await expect(service.create(dto())).rejects.toMatchObject({
      response: {
        errors: [expect.objectContaining({ code: 'MOBILE_RETURN_BILL_OTHER_CUSTOMER' })],
      },
    });
    expect(returns.saveInTx).not.toHaveBeenCalled();
  });
});

describe('MobileReturnService.delete', () => {
  const del = { srClientUuid: CLIENT_UUID, deviceUid: 'phone-1', srCompanyId: COMPANY };

  it('deletes the phone DRAFT through the desktop, withdrawing its own request first', async () => {
    const { service, returns } = build({ stored: returnRow({ srStatus: 'DRAFT' }) });
    const out = await service.delete(del);
    expect(out).toEqual({
      deleted: true,
      srClientUuid: CLIENT_UUID,
      srId: CLIENT_UUID,
      srReturnRefno: 'SRT/2026-2027/D15/00001',
      duplicate: false,
    });
    expect(returns.deleteInTx).toHaveBeenCalledWith(
      expect.anything(),
      { id: CLIENT_UUID, companyId: COMPANY, branchId: BRANCH, accYear: '2026-2027' },
      { withdrawPendingNote: 'Withdrawn from the phone by VKPOS: the return was deleted' },
    );
  });

  it('unknown: deleted false; deleted before: duplicate; POSTED: 409 SALES_DOC_POSTED', async () => {
    expect((await build({ stored: null }).service.delete(del)).deleted).toBe(false);
    expect(
      (
        await build({ stored: returnRow({ srStatus: 'DRAFT', srIsDeleted: true }) }).service.delete(
          del,
        )
      ).duplicate,
    ).toBe(true);
    await expect(build({ stored: returnRow() }).service.delete(del)).rejects.toMatchObject({
      response: { errors: [expect.objectContaining({ code: 'SALES_DOC_POSTED' })] },
    });
  });
});
