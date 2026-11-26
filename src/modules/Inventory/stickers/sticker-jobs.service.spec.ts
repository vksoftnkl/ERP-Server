import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrintRenderService } from '../../settings/print-render/print-render.service';
import { PrintTemplateAssignmentService } from '../../settings/print-template-assignment/print-template-assignment.service';
import { StickerJobsService } from './sticker-jobs.service';
import { DesignRow, StickerLinesService } from './sticker-lines.service';
import { StickerRefusal } from './sticker.errors';
import { BuiltStickerLine, StickerLine } from './types/sticker.types';

/**
 * Sticker jobs (plan S-P1 §4.7 / §4.8, §9.1 J1-J8): the §7.2 refusal order,
 * numbering per counter, freezing the SERVER's figures, the one status step,
 * reprint (reason, original's frozen lines) and resend (failed only, once).
 */

const D = (value: number | string) => new Prisma.Decimal(value);
const COMPANY = 'c0000000-0000-7000-8000-000000000001';
const BRANCH = 'b0000000-0000-7000-8000-000000000001';
const DEVICE = 'dev-0000-0000-7000-8000-000000000008';
const TEMPLATE = 'd0000000-0000-7000-8000-000000000001';

const DESIGN: DesignRow = {
  ptl_id: TEMPLATE,
  ptl_name: 'SAMPLE item 50 × 25',
  ptl_company_id: null,
  ptl_is_active: true,
  ptl_is_deleted: false,
  ppo_code: 'ITEM_LABEL',
  ptv_id: 'ver-1',
  ptv_rev_no: 1,
  ptv_status: 'PUBLISHED',
  ptv_is_deleted: false,
  ptv_label_width_mm: D(50),
  ptv_label_height_mm: D(25),
  ptv_label_across: 2,
  ptv_label_down: 1,
  ptv_paper_code: 'LABEL',
  ptv_body: '{"bands":[]}',
};

function builtLine(over: Partial<StickerLine> = {}, refusal?: StickerRefusal): BuiltStickerLine {
  return {
    line: {
      key: '1',
      itemId: 'item-1',
      itemName: 'ZT Oil',
      itemNameTa: null,
      itemCode: 'OIL1',
      unitId: 'iuc-1',
      unitName: 'PCS',
      isDefaultUnit: true,
      barcode: '8901234567890',
      barcodeSource: 'UNIT',
      lotId: 'lot-1',
      batchNo: 'B1',
      mfgDate: '2026-11-01',
      expiryDate: '2027-04-30',
      lotRequired: false,
      lotCount: 1,
      mrp: 165,
      price: 96.2,
      priceLevel: 2,
      costCode: 'LBK',
      priceCode: 'EO',
      templateId: TEMPLATE,
      templateName: 'SAMPLE item 50 × 25',
      designSource: 'JOB',
      designHasBarcode: true,
      labelWidthMm: 50,
      labelHeightMm: 25,
      labelsAcross: 2,
      labelsDown: 1,
      paperCode: 'LABEL',
      labels: 3,
      stockQty: 12,
      lastPrintedOn: null,
      lastPrintedLabels: null,
      problem: refusal ? refusal.toProblem() : null,
      ...over,
    },
    facts: {
      mrp: D('165.004'),
      price: D('96.20'),
      cost: D(104),
      versionId: 'ver-1',
      brand: null,
      groupName: null,
      size: null,
      colour: null,
      model: null,
      priceLevelShort: 'RET',
      unitHasDecimals: false,
    },
    ...(refusal ? { refusal } : {}),
  };
}

const jobRow = (over: Record<string, unknown> = {}) => ({
  lbj_id: 'job-orig',
  lbj_acc_year: '2026-2027',
  lbj_company_id: COMPANY,
  lbj_branch_id: BRANCH,
  lbj_device_id: DEVICE,
  lbj_refno: 'D8-000001',
  lbj_purpose_id: 'ppo-item',
  lbj_template_id: TEMPLATE,
  lbj_version_id: 'ver-1',
  lbj_printer_name: 'ZT-PRN',
  lbj_printer_dpi: 203,
  lbj_price_level: 2,
  lbj_start_at: 1,
  lbj_kind: 'PRINT',
  lbj_reprint_of_id: null,
  lbj_reprint_of_acc_year: null,
  lbj_resend_of_id: null,
  lbj_resend_of_acc_year: null,
  lbj_reason_code: null,
  lbj_reason_note: null,
  lbj_line_count: 2,
  lbj_label_count: 5,
  lbj_page_count: 3,
  lbj_status: 'PRINTED',
  lbj_status_on: null,
  lbj_printer_message: null,
  lbj_printed_on: new Date('2026-11-25T05:00:00Z'),
  lbj_printed_by: 'user-1',
  ...over,
});

const jobLine = (id: string, lineNo: number, over: Record<string, unknown> = {}) => ({
  lbjl_id: id,
  lbjl_line_no: lineNo,
  lbjl_item_id: `item-${lineNo}`,
  lbjl_unit_id: `iuc-${lineNo}`,
  lbjl_lot_id: null,
  lbjl_barcode: '4006381333931',
  lbjl_mrp: D('110.00'),
  lbjl_price: D('104.00'),
  lbjl_batch_no: null,
  lbjl_mfg_date: null,
  lbjl_expiry_date: '2027-01-31',
  lbjl_cost_code: 'EO',
  lbjl_price_code: 'LBK',
  lbjl_labels: 2 + lineNo,
  lbjl_reprint_of_line_id: null,
  item_name: `Item ${lineNo}`,
  item_name_ta: null,
  item_code: null,
  brand: null,
  group_name: null,
  unit_name: 'PCS',
  size: null,
  colour: null,
  model: null,
  reprinted: 0,
  ...over,
});

interface World {
  jobs: Record<string, ReturnType<typeof jobRow>>;
  lines: Record<string, ReturnType<typeof jobLine>[]>;
  /** Resends of the failed job that the quick check (outside the transaction) sees. */
  resends?: Array<{ refno: string; status: string }>;
  /** What the same check sees inside the job's transaction (default: `resends`). */
  txResends?: Array<{ refno: string; status: string }>;
  /** The reprint jobs /jobs/get lists. */
  reprints?: Array<Record<string, unknown>>;
  maxSlno?: number;
  deviceId?: string | null;
  built?: BuiltStickerLine[];
}

function setup(world: World) {
  const created: Array<Record<string, any>> = [];
  const steps: Array<Record<string, any>> = [];
  const updates: Array<Record<string, any>> = [];
  const sqls: string[] = [];
  const txSqls: string[] = [];
  const tx = {
    $queryRaw: jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      txSqls.push(sql);
      if (sql.includes('pg_advisory_xact_lock')) return Promise.resolve([{ locked: 1 }]);
      if (sql.includes('MAX(lbj_slno)')) return Promise.resolve([{ n: (world.maxSlno ?? 3) + 1 }]);
      if (sql.includes('lbj_resend_of_id =')) {
        return Promise.resolve(world.txResends ?? world.resends ?? []);
      }
      throw new Error(`tx: unexpected ${sql.slice(0, 80)}`);
    }),
    deviceMaster: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          devId: DEVICE,
          devCode: 'D8',
          devIsActive: true,
          devIsBlocked: false,
          devBlockReason: null,
        }),
      ),
    },
    labelJob: {
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        created.push(data);
        return Promise.resolve({
          lbjId: 'job-new',
          lines: data.lines.create.map((line: Record<string, unknown>, index: number) => ({
            lbjlId: `new-line-${index + 1}`,
            ...line,
          })),
        });
      }),
      updateMany: jest.fn((args: Record<string, any>) => {
        updates.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
    txnStatusLog: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create: jest.fn(({ data }: { data: Record<string, any> }) => {
        steps.push(data);
        return Promise.resolve(data);
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => unknown) => Promise.resolve(work(tx))),
    $queryRaw: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      sqls.push(sql);
      if (sql.includes('SELECT * FROM inventory.label_job')) {
        const job = world.jobs[values[0] as string];
        return Promise.resolve(job ? [job] : []);
      }
      if (sql.includes('WITH mine AS')) return Promise.resolve(world.reprints ?? []);
      if (sql.includes('FROM inventory.label_job_line l')) {
        return Promise.resolve(world.lines[values[values.length - 2] as string] ?? []);
      }
      if (sql.includes('lbj_resend_of_id =')) return Promise.resolve(world.resends ?? []);
      if (sql.includes('FROM public.print_purpose p')) {
        return Promise.resolve([
          {
            purpose_code: 'ITEM_LABEL',
            template_name: 'SAMPLE item 50 × 25',
            rev_no: 1,
            width: D(50),
            height: D(25),
            across: 2,
            down: 1,
            paper_code: 'LABEL',
            printed_by_name: 'VKPOS',
            device_code: 'D8',
            device_name: 'VKPOS1',
            reprint_of_no: values[0] ? 'D8-000001' : null,
            resend_of_no: values[2] ? 'D8-000002' : null,
          },
        ]);
      }
      if (sql.includes('FROM public.companys c')) {
        return Promise.resolve([
          { comp_name: 'Acme', comp_legal_name: null, br_name: 'CBE', br_short: null },
        ]);
      }
      if (sql.includes('FROM fixed.price_levels')) return Promise.resolve([{ short: 'RET' }]);
      if (sql.includes('FROM public.fiscal_years')) return Promise.resolve([{ name: '2026-2027' }]);
      throw new Error(`prisma: unexpected ${sql.slice(0, 80)}`);
    }),
  } as unknown as PrismaService;
  const context = {
    getUserId: () => 'user-1',
    getDeviceId: () => (world.deviceId === undefined ? DEVICE : world.deviceId),
  } as unknown as RequestContextService;

  const lines = new StickerLinesService(prisma, context, {} as PrintTemplateAssignmentService);
  jest.spyOn(lines, 'assertRight').mockResolvedValue();
  jest.spyOn(lines, 'assertBranchInCompany').mockResolvedValue();
  jest
    .spyOn(lines, 'loadPurpose')
    .mockImplementation((_company: string, code: string) =>
      Promise.resolve({ ppoId: `ppo-${code}`, ppoCode: code as 'ITEM_LABEL', ppoName: code }),
    );
  jest.spyOn(lines, 'loadDesigns').mockResolvedValue(new Map([[TEMPLATE, DESIGN]]));
  const buildLines = jest
    .spyOn(lines, 'buildLines')
    .mockResolvedValue(world.built ?? [builtLine()]);

  const rowsSeen: Array<Record<string, unknown>[]> = [];
  const render = {
    renderLabels: jest.fn(
      (request: { rows: Array<{ row: Record<string, unknown>; labels: number }> }) => {
        rowsSeen.push(request.rows.map((entry) => ({ ...entry.row, labels: entry.labels })));
        return Promise.resolve({
          bytes: Buffer.from('%PDF-1.3'),
          pageCount: 2,
          startAt: 1,
          warnings: [],
        });
      },
    ),
  } as unknown as PrintRenderService;

  const service = new StickerJobsService(prisma, context, lines, render);
  return { service, created, steps, updates, rowsSeen, buildLines, sqls, txSqls };
}

const printBody = (over: Record<string, unknown> = {}) => ({
  companyId: COMPANY,
  branchId: BRANCH,
  purposeCode: 'ITEM_LABEL',
  templateId: TEMPLATE,
  printerName: ' TSC TE244 ',
  priceLevel: 2,
  lines: [{ itemId: 'item-1', unitId: 'iuc-1', labels: 3 }],
  ...over,
});

const codeOf = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (error: { response?: { errors?: Array<{ code: string; line?: number }> }; status?: number }) =>
      `${error.status}:${error.response?.errors?.[0]?.code}${error.response?.errors?.[0]?.line ? `@${error.response.errors[0].line}` : ''}`,
  );

describe('StickerJobsService.print (J1, J4)', () => {
  it('numbers the job per counter (D8-000004), freezes the SERVER’s figures, logs SENT', async () => {
    const { service, created, steps, rowsSeen, buildLines } = setup({ jobs: {}, lines: {} });
    const answer = await service.print(
      printBody({ lines: [{ itemId: 'item-1', unitId: 'iuc-1', labels: 3, mrp: 1 }] }),
    );
    expect(answer.inspect).toMatchObject({
      jobId: 'job-new',
      jobNo: 'D8-000004',
      accYear: '2026-2027',
      labels: 3,
      pages: 2,
    });
    const job = created[0];
    expect(job).toMatchObject({
      lbjSlno: 4,
      lbjRefno: 'D8-000004',
      lbjKind: 'PRINT',
      lbjStatus: 'SENT',
      lbjPrinterName: 'TSC TE244',
      lbjVersionId: 'ver-1',
      lbjLineCount: 1,
      lbjLabelCount: 3,
      lbjPrintedBy: 'user-1',
      lbjDeviceId: DEVICE,
    });
    const line = job.lines.create[0];
    // numeric(14,2): the resolved 165.004 is stored 165.00 — never a client figure.
    expect(line.lbjlMrp.toFixed(2)).toBe('165.00');
    expect(line).toMatchObject({
      lbjlBarcode: '8901234567890',
      lbjlCostCode: 'LBK',
      lbjlLabels: 3,
      lbjlLotId: 'lot-1',
    });
    expect(line.lbjlExpiryDate.toISOString()).toBe('2027-04-30T00:00:00.000Z');
    expect(steps[0]).toMatchObject({
      tslSrcDocType: 'LABEL_JOB',
      tslEvent: 'SENT',
      tslToStatus: 'SENT',
      tslSeqNo: 1,
    });
    expect(rowsSeen[0][0]).toMatchObject({
      job_no: 'D8-000004',
      item_name: 'ZT Oil',
      mrp: 165,
      price: 96.2,
      labels: 3,
    });
    // Every line re-resolved with the job's design.
    expect(buildLines.mock.calls[0][0].jobTemplateId).toBe(TEMPLATE);
  });

  it('refuses in the §7.2 order', async () => {
    expect(
      await codeOf(
        setup({ jobs: {}, lines: {} }).service.print(printBody({ templateId: undefined })),
      ),
    ).toBe('422:STICKER_NO_DESIGN');
    expect(
      await codeOf(setup({ jobs: {}, lines: {} }).service.print(printBody({ printerName: '  ' }))),
    ).toBe('422:STICKER_NO_PRINTER');
    expect(
      await codeOf(setup({ jobs: {}, lines: {}, deviceId: null }).service.print(printBody())),
    ).toBe('404:STOCK_DEVICE_NOT_FOUND');
    expect(
      await codeOf(setup({ jobs: {}, lines: {} }).service.print(printBody({ lines: [] }))),
    ).toBe('422:STICKER_NOTHING_TO_PRINT');
  });

  it('a pack design on an item list is STICKER_DESIGN_NOT_LABEL rule=PURPOSE', async () => {
    const world = setup({ jobs: {}, lines: {} });
    await expect(
      world.service.print(printBody({ purposeCode: 'PACK_LABEL' })),
    ).rejects.toMatchObject({
      response: {
        errors: [expect.objectContaining({ code: 'STICKER_DESIGN_NOT_LABEL', rule: 'PURPOSE' })],
      },
    });
  });

  it('a line problem is refused with its line number; lot required; no barcode; > 5,000 labels', async () => {
    const unit = new StickerRefusal('STICKER_UNIT_NOT_OF_ITEM', 'x', 'unitId');
    expect(
      await codeOf(
        setup({ jobs: {}, lines: {}, built: [builtLine(), builtLine({}, unit)] }).service.print(
          printBody(),
        ),
      ),
    ).toBe('422:STICKER_UNIT_NOT_OF_ITEM@2');
    expect(
      await codeOf(
        setup({
          jobs: {},
          lines: {},
          built: [builtLine({ lotRequired: true, lotId: null })],
        }).service.print(printBody()),
      ),
    ).toBe('422:STICKER_LOT_REQUIRED@1');
    expect(
      await codeOf(
        setup({ jobs: {}, lines: {}, built: [builtLine({ barcode: null })] }).service.print(
          printBody(),
        ),
      ),
    ).toBe('422:STICKER_LINE_NO_BARCODE@1');
    expect(
      await codeOf(
        setup({
          jobs: {},
          lines: {},
          built: [builtLine({ labels: 3000 }), builtLine({ labels: 2001 })],
        }).service.print(printBody()),
      ),
    ).toBe('422:STICKER_TOO_MANY_LABELS');
  });
});

describe('StickerJobsService.status (J3)', () => {
  const body = { companyId: COMPANY, branchId: BRANCH, accYear: '2026-2027', jobId: 'job-orig' };
  it('SENT → PRINTED: one guarded update and the PRINTED step', async () => {
    const world = setup({ jobs: { 'job-orig': jobRow({ lbj_status: 'SENT' }) }, lines: {} });
    const answer = await world.service.status({ ...body, status: 'PRINTED' });
    expect(answer).toMatchObject({ jobId: 'job-orig', jobNo: 'D8-000001', status: 'PRINTED' });
    expect(world.updates[0].where).toMatchObject({ lbjStatus: 'SENT' });
    expect(world.steps[0]).toMatchObject({
      tslEvent: 'PRINTED',
      tslFromStatus: 'SENT',
      tslToStatus: 'PRINTED',
    });
  });
  it('FAILED keeps the printer’s message (250 max) as the step’s remarks', async () => {
    const world = setup({ jobs: { 'job-orig': jobRow({ lbj_status: 'SENT' }) }, lines: {} });
    await world.service.status({ ...body, status: 'FAILED', printerMessage: 'x'.repeat(300) });
    expect(world.updates[0].data.lbjPrinterMessage).toHaveLength(250);
    expect(world.steps[0]).toMatchObject({ tslEvent: 'PRINT_FAILED', tslToStatus: 'FAILED' });
  });
  it('SF6: an old SENT job (an earlier year) is marked by its own counter, no age limit', async () => {
    const world = setup({
      jobs: {
        'job-orig': jobRow({
          lbj_status: 'SENT',
          lbj_acc_year: '2025-2026',
          lbj_printed_on: new Date('2025-06-01T05:00:00Z'),
        }),
      },
      lines: {},
    });
    const answer = await world.service.status({ ...body, accYear: '2025-2026', status: 'FAILED' });
    expect(answer).toMatchObject({ status: 'FAILED' });
    expect(world.updates[0].where).toMatchObject({ lbjAccYear: '2025-2026', lbjStatus: 'SENT' });
    expect(world.steps[0]).toMatchObject({ tslAccYear: '2025-2026', tslToStatus: 'FAILED' });
  });
  it('again → 409 STICKER_JOB_STATUS_SET; another counter → 403; unknown → 404', async () => {
    const set = setup({ jobs: { 'job-orig': jobRow({ lbj_status: 'PRINTED' }) }, lines: {} });
    expect(await codeOf(set.service.status({ ...body, status: 'PRINTED' }))).toBe(
      '409:STICKER_JOB_STATUS_SET',
    );
    const other = setup({
      jobs: { 'job-orig': jobRow({ lbj_status: 'SENT', lbj_device_id: 'dev-other' }) },
      lines: {},
    });
    expect(await codeOf(other.service.status({ ...body, status: 'PRINTED' }))).toBe(
      '403:STICKER_JOB_OTHER_COUNTER',
    );
    const none = setup({ jobs: {}, lines: {} });
    expect(await codeOf(none.service.status({ ...body, status: 'PRINTED' }))).toBe(
      '404:STICKER_JOB_NOT_FOUND',
    );
  });
});

describe('StickerJobsService.reprint (J5, J6)', () => {
  const lines = { 'job-orig': [jobLine('line-1', 1), jobLine('line-2', 2)] };
  const body = (over: Record<string, unknown> = {}) => ({
    companyId: COMPANY,
    branchId: BRANCH,
    accYear: '2026-2027',
    jobId: 'job-orig',
    reasonCode: 'TORN',
    printerName: 'TSC TE244',
    lines: [
      { lineId: 'line-1', labels: 0 },
      { lineId: 'line-2', labels: 2 },
    ],
    ...over,
  });

  it('TORN, 2 labels of line 2 → a REPRINT job copying the original’s frozen figures', async () => {
    const world = setup({ jobs: { 'job-orig': jobRow() }, lines });
    const answer = await world.service.reprint(body());
    const job = world.created[0];
    expect(job).toMatchObject({
      lbjKind: 'REPRINT',
      lbjReprintOfId: 'job-orig',
      lbjReprintOfAccYear: '2026-2027',
      lbjReasonCode: 'TORN',
      lbjVersionId: 'ver-1',
      lbjLineCount: 1,
      lbjLabelCount: 2,
    });
    expect(job.lines.create[0]).toMatchObject({
      lbjlLineNo: 1,
      lbjlItemId: 'item-2',
      lbjlReprintOfLineId: 'line-2',
      lbjlLabels: 2,
      lbjlCostCode: 'EO',
    });
    expect(job.lines.create[0].lbjlMrp.toFixed(2)).toBe('110.00');
    expect(world.steps[0]).toMatchObject({ tslEvent: 'SENT', tslRemarks: 'Label torn / fell off' });
    expect(answer.inspect.labels).toBe(2);
  });

  it('a reprint of a reprint goes back to its original', async () => {
    const world = setup({
      jobs: {
        'job-orig': jobRow(),
        'job-rep': jobRow({
          lbj_id: 'job-rep',
          lbj_kind: 'REPRINT',
          lbj_reprint_of_id: 'job-orig',
          lbj_reprint_of_acc_year: '2026-2027',
          lbj_reason_code: 'TORN',
        }),
      },
      lines,
    });
    await world.service.reprint(body({ jobId: 'job-rep' }));
    expect(world.created[0]).toMatchObject({ lbjReprintOfId: 'job-orig' });
  });

  describe('a reprint of a REPRINT job: its own line ids or the original’s', () => {
    const repJobs = {
      'job-orig': jobRow(),
      'job-rep': jobRow({
        lbj_id: 'job-rep',
        lbj_refno: 'D8-000004',
        lbj_kind: 'REPRINT',
        lbj_reprint_of_id: 'job-orig',
        lbj_reprint_of_acc_year: '2026-2027',
        lbj_reason_code: 'TORN',
      }),
    };
    const repLines = {
      ...lines,
      'job-rep': [
        jobLine('rep-line-1', 1, { lbjl_item_id: 'item-2', lbjl_reprint_of_line_id: 'line-2' }),
      ],
    };
    const run = (rows: Array<{ lineId: string; labels: number }>) => {
      const world = setup({ jobs: repJobs, lines: repLines });
      return { world, answer: world.service.reprint(body({ jobId: 'job-rep', lines: rows })) };
    };

    it('the selected reprint job’s line id maps to the original line it reprinted', async () => {
      const { world, answer } = run([{ lineId: 'rep-line-1', labels: 2 }]);
      await answer;
      expect(world.created[0]).toMatchObject({ lbjReprintOfId: 'job-orig', lbjLabelCount: 2 });
      expect(world.created[0].lines.create).toEqual([
        expect.objectContaining({
          lbjlItemId: 'item-2',
          lbjlReprintOfLineId: 'line-2',
          lbjlLabels: 2,
        }),
      ]);
    });

    it('the original’s line ids keep working', async () => {
      const { world, answer } = run([{ lineId: 'line-1', labels: 1 }]);
      await answer;
      expect(world.created[0].lines.create).toEqual([
        expect.objectContaining({
          lbjlItemId: 'item-1',
          lbjlReprintOfLineId: 'line-1',
          lbjlLabels: 1,
        }),
      ]);
    });

    it('both forms naming one original line add up to one job line', async () => {
      const { world, answer } = run([
        { lineId: 'rep-line-1', labels: 2 },
        { lineId: 'line-2', labels: 3 },
      ]);
      await answer;
      expect(world.created[0].lines.create).toEqual([
        expect.objectContaining({ lbjlLineNo: 1, lbjlReprintOfLineId: 'line-2', lbjlLabels: 5 }),
      ]);
      expect(world.created[0]).toMatchObject({ lbjLineCount: 1, lbjLabelCount: 5 });
    });

    it('a line of neither job → STICKER_LINE_NOT_ON_JOB; a sum over 9,999 → STICKER_LABELS_INVALID', async () => {
      expect(await codeOf(run([{ lineId: 'line-9', labels: 1 }]).answer)).toBe(
        '422:STICKER_LINE_NOT_ON_JOB@1',
      );
      expect(
        await codeOf(
          run([
            { lineId: 'rep-line-1', labels: 5000 },
            { lineId: 'line-2', labels: 5000 },
          ]).answer,
        ),
      ).toBe('422:STICKER_LABELS_INVALID@2');
    });
  });

  it('refusals: reason required / invalid / Other needs a note / not printed / foreign line / all 0', async () => {
    const make = (jobs = { 'job-orig': jobRow() }) => setup({ jobs, lines }).service;
    expect(await codeOf(make().reprint(body({ reasonCode: undefined })))).toBe(
      '422:STICKER_REASON_REQUIRED',
    );
    expect(await codeOf(make().reprint(body({ reasonCode: 'FOO' })))).toBe(
      '422:STICKER_REASON_INVALID',
    );
    expect(await codeOf(make().reprint(body({ reasonCode: 'OTHER', reasonNote: ' ' })))).toBe(
      '422:STICKER_NOTE_REQUIRED',
    );
    expect(
      await codeOf(make({ 'job-orig': jobRow({ lbj_status: 'FAILED' }) }).reprint(body())),
    ).toBe('422:STICKER_REPRINT_NOT_PRINTED');
    expect(await codeOf(make().reprint(body({ lines: [{ lineId: 'line-9', labels: 1 }] })))).toBe(
      '422:STICKER_LINE_NOT_ON_JOB@1',
    );
    expect(await codeOf(make().reprint(body({ lines: [{ lineId: 'line-1', labels: 0 }] })))).toBe(
      '422:STICKER_NOTHING_TO_PRINT',
    );
  });
});

describe('StickerJobsService.resend (J7)', () => {
  const body = {
    companyId: COMPANY,
    branchId: BRANCH,
    accYear: '2026-2027',
    jobId: 'job-orig',
    printerName: 'TSC TE244',
  };
  const lines = { 'job-orig': [jobLine('line-1', 1)] };
  it('a FAILED job → a new PRINT job with resend_of, the same frozen lines, no reason', async () => {
    const world = setup({ jobs: { 'job-orig': jobRow({ lbj_status: 'FAILED' }) }, lines });
    await world.service.resend(body);
    expect(world.created[0]).toMatchObject({
      lbjKind: 'PRINT',
      lbjResendOfId: 'job-orig',
      lbjReasonCode: null,
      lbjReprintOfId: null,
      lbjLabelCount: 3,
    });
    expect(world.created[0].lines.create[0]).toMatchObject({
      lbjlLabels: 3,
      lbjlReprintOfLineId: null,
    });
    expect(world.steps[0]).toMatchObject({ tslRemarks: 'Sent again' });
  });
  it('a PRINTED job → STICKER_RESEND_NOT_FAILED; once a resend printed → 409 STICKER_ALREADY_RESENT', async () => {
    expect(
      await codeOf(setup({ jobs: { 'job-orig': jobRow() }, lines }).service.resend(body)),
    ).toBe('422:STICKER_RESEND_NOT_FAILED');
    const printed = setup({
      jobs: { 'job-orig': jobRow({ lbj_status: 'FAILED' }) },
      lines,
      resends: [{ refno: 'D8-000002', status: 'PRINTED' }],
    });
    const error = await printed.service.resend(body).catch((e: any) => e);
    expect(error.status).toBe(409);
    expect(error.response.errors[0]).toMatchObject({ code: 'STICKER_ALREADY_RESENT', field: 'jobId' });
    expect(error.response.errors[0].rule).toBeUndefined();
    expect(printed.created).toHaveLength(0);
  });

  const ruleOf = (promise: Promise<unknown>) =>
    promise.then(
      () => 'resolved',
      (e: any) => `${e.status}:${e.response?.errors?.[0]?.code}:${e.response?.errors?.[0]?.rule ?? ''}`,
    );

  it('SF1: while a resend of the job is still SENT → 409 STICKER_ALREADY_RESENT rule=SENT, no job', async () => {
    const world = setup({
      jobs: { 'job-orig': jobRow({ lbj_status: 'FAILED' }) },
      lines,
      resends: [{ refno: 'D8-000005', status: 'SENT' }],
    });
    expect(await ruleOf(world.service.resend(body))).toBe('409:STICKER_ALREADY_RESENT:SENT');
    expect(world.created).toHaveLength(0);
    // the check reads SENT and PRINTED resends only: a FAILED resend never blocks
    const check = world.sqls.find((sql) => sql.includes('lbj_resend_of_id ='));
    expect(check).toContain("lbj_status IN ('SENT', 'PRINTED')");
  });

  it('SF1: two presses at once — the second sees the first inside the transaction, under the per-job lock', async () => {
    const world = setup({
      jobs: { 'job-orig': jobRow({ lbj_status: 'FAILED' }) },
      lines,
      resends: [],
      txResends: [{ refno: 'D8-000005', status: 'SENT' }],
    });
    expect(await ruleOf(world.service.resend(body))).toBe('409:STICKER_ALREADY_RESENT:SENT');
    expect(world.created).toHaveLength(0);
    const lockAt = world.txSqls.findIndex((sql) => sql.includes("hashtext('label_job_resend')"));
    const checkAt = world.txSqls.findIndex((sql) => sql.includes('lbj_resend_of_id ='));
    const numberAt = world.txSqls.findIndex((sql) => sql.includes('MAX(lbj_slno)'));
    expect(lockAt).toBeGreaterThanOrEqual(0);
    expect(checkAt).toBeGreaterThan(lockAt);
    expect(numberAt).toBe(-1);
  });

  it('SF1: no SENT / PRINTED resend → the resend goes out, its in-transaction check passes first', async () => {
    const world = setup({ jobs: { 'job-orig': jobRow({ lbj_status: 'FAILED' }) }, lines, resends: [] });
    await world.service.resend(body);
    expect(world.created).toHaveLength(1);
    const checkAt = world.txSqls.findIndex((sql) => sql.includes('lbj_resend_of_id ='));
    const numberAt = world.txSqls.findIndex((sql) => sql.includes('MAX(lbj_slno)'));
    expect(checkAt).toBeGreaterThanOrEqual(0);
    expect(numberAt).toBeGreaterThan(checkAt);
  });
});

const reprintRow = (over: Record<string, unknown> = {}) => ({
  lbj_id: 'r-1',
  lbj_acc_year: '2026-2027',
  lbj_refno: 'D8-000086',
  lbj_kind: 'REPRINT',
  lbj_printed_on: new Date('2026-11-26T04:34:00Z'),
  lbj_status: 'PRINTED',
  lbj_reason_code: 'TORN',
  lbj_reason_note: null,
  lbj_resend_of_id: null,
  resend_of_no: null,
  why_code: 'TORN',
  why_note: null,
  labels: 2,
  ...over,
});

describe('StickerJobsService.get (SF2, SF5, RR6)', () => {
  const q = { companyId: COMPANY, branchId: BRANCH, accYear: '2027-2028', id: 'job-rep' };
  it('a reprint made in a new year names its original’s year (reprintOfAccYear); resend keys null', async () => {
    const world = setup({
      jobs: {
        'job-rep': jobRow({
          lbj_id: 'job-rep',
          lbj_acc_year: '2027-2028',
          lbj_kind: 'REPRINT',
          lbj_reprint_of_id: 'job-orig',
          lbj_reprint_of_acc_year: '2026-2027',
          lbj_reason_code: 'TORN',
        }),
      },
      lines: { 'job-rep': [jobLine('rep-line-1', 1, { lbjl_reprint_of_line_id: 'line-1' })] },
    });
    const answer = await world.service.get(q);
    expect(answer.job).toMatchObject({
      jobId: 'job-rep',
      accYear: '2027-2028',
      reprintOfJobId: 'job-orig',
      reprintOfJobNo: 'D8-000001',
      reprintOfAccYear: '2026-2027',
      resendOfJobId: null,
      resendOfJobNo: null,
      resendOfAccYear: null,
    });
  });
  it('a resend names the failed job and its year (resendOfJobId / resendOfAccYear)', async () => {
    const world = setup({
      jobs: {
        'job-rep': jobRow({
          lbj_id: 'job-rep',
          lbj_resend_of_id: 'job-failed',
          lbj_resend_of_acc_year: '2026-2027',
        }),
      },
      lines: { 'job-rep': [jobLine('line-9', 1)] },
    });
    const answer = await world.service.get(q);
    expect(answer.job).toMatchObject({
      reprintOfJobId: null,
      reprintOfAccYear: null,
      resendOfJobId: 'job-failed',
      resendOfJobNo: 'D8-000002',
      resendOfAccYear: '2026-2027',
    });
  });
  it('SF2: Reprinted sums the lines of every job pointing at the line except FAILED jobs', async () => {
    const world = setup({
      jobs: { 'job-rep': jobRow({ lbj_id: 'job-rep' }) },
      lines: { 'job-rep': [] },
      reprints: [reprintRow({ lbj_status: 'FAILED', labels: 1 })],
    });
    const answer = await world.service.get(q);
    // the reprints list still names a FAILED reprint, with its status
    expect(answer.reprints).toEqual([
      expect.objectContaining({ jobNo: 'D8-000086', labels: 1, status: 'FAILED' }),
    ]);
    const lineSql = world.sqls.find((sql) => sql.includes('AS reprinted'));
    expect(lineSql).toMatch(
      /JOIN inventory\.label_job rj\s+ON rj\.lbj_id = r\.lbjl_job_id AND rj\.lbj_acc_year = r\.lbjl_acc_year/,
    );
    expect(lineSql).toContain("rj.lbj_status <> 'FAILED'");
  });
  it('RR6: reprints[] comes from the same lines as Reprinted, so a resend of a failed reprint is listed', async () => {
    const world = setup({
      jobs: { 'job-rep': jobRow({ lbj_id: 'job-rep' }) },
      lines: { 'job-rep': [] },
      reprints: [
        reprintRow({ lbj_status: 'FAILED' }),
        reprintRow({
          lbj_id: 's-1',
          lbj_refno: 'D8-000093',
          lbj_kind: 'PRINT',
          lbj_reason_code: null,
          lbj_resend_of_id: 'r-1',
          resend_of_no: 'D8-000086',
          why_code: 'OTHER',
          why_note: 'smudged',
        }),
      ],
    });
    const answer = await world.service.get(q);
    expect(answer.reprints).toEqual([
      {
        jobId: 'r-1',
        jobNo: 'D8-000086',
        accYear: '2026-2027',
        kind: 'REPRINT',
        printedOn: expect.any(String),
        labels: 2,
        reasonText: 'Label torn / fell off',
        status: 'FAILED',
        resendOfJobId: null,
        resendOfJobNo: null,
      },
      {
        jobId: 's-1',
        jobNo: 'D8-000093',
        accYear: '2026-2027',
        kind: 'PRINT',
        printedOn: expect.any(String),
        labels: 2,
        reasonText: expect.stringContaining('smudged'),
        status: 'PRINTED',
        resendOfJobId: 'r-1',
        resendOfJobNo: 'D8-000086',
      },
    ]);
    // the list reads the jobs whose lines point at this job's lines (the Reprinted source)
    const listSql = world.sqls.find((sql) => sql.includes('WITH mine AS')) ?? '';
    expect(listSql).toContain('r.lbjl_reprint_of_line_id IN (SELECT lbjl_id FROM mine)');
    expect(listSql).toContain('WITH RECURSIVE up');
  });
});
