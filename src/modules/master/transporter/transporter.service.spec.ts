import { ConflictException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  isLedgerNameTaken,
  TRANSPORTER_LEDGER_GROUP_ID,
  transporterLedgerFields,
  TransporterService,
} from './transporter.service';
import type { SaveTransporterDto } from './dto/save-transporter.dto';
import { TransporterErrorCode } from './types/transporter-error-codes';

const COMPANY = '019c6f6c-be87-7a11-8905-36092c46e401';
const OTHER_COMPANY = '019c6f6c-be87-7a11-8905-36092c46e402';
const USER = '019c6f6c-be87-7a11-8905-36092c46e403';
const TRN = '019c6f6c-be87-7a11-8905-36092c46e404';
const OLD_GROUP = '019c6f6c-be87-7a11-8905-36092c46e405';

const ALL_RIGHTS = {
  um_can_view: true, um_can_create: true, um_can_edit: true, um_can_delete: true,
  um_can_print: true, um_can_export: true, um_can_post: false, um_can_cancel: false,
  um_can_amend: false, um_can_override: false, um_can_retender: false,
};

const storedRow = (over: Record<string, unknown> = {}) => ({
  trnId: TRN, trnCompanyId: COMPANY, trnCode: 'KPN', trnName: 'KPN Parcel Service', trnGstin: null,
  trnIsEnrolmentId: false, trnMode: 'ROAD', trnLedgerId: TRN, trnPhone: null, trnEmail: null, trnAddr: null,
  trnPlace: null, trnPin: null, trnStateCode: null, trnRemarks: null, trnIsActive: true, trnIsDeleted: false,
  trnSyncDate: null, trnCreatedOn: new Date(), trnCreatedBy: USER, trnModifiedOn: null, trnModifiedBy: null, ...over,
});

const payloadRow = {
  trn_id: TRN, trn_company_id: COMPANY, trn_code: 'KPN', trn_name: 'KPN Parcel Service', trn_gstin: '33ABCDE1234F1Z5',
  trn_is_enrolment_id: false, trn_mode: 'ROAD', trn_phone: null, trn_email: null, trn_addr: null, trn_place: null,
  trn_pin: null, trn_state_code: '33', state_name: 'Tamil Nadu', trn_remarks: null, trn_is_active: true,
  trn_ledger_id: TRN, led_name: 'KPN Parcel Service', acc_group_name: 'Transporters', vehicle_count: 2,
  trn_created_by: USER, trn_created_on: new Date('2026-11-12T05:00:00Z'), trn_modified_by: null, trn_modified_on: null,
};

interface Setup {
  companyLive?: boolean;
  rights?: Partial<typeof ALL_RIGHTS>;
  company?: string | null;
  existing?: ReturnType<typeof storedRow> | null;
  dup?: boolean;
  stateOk?: boolean;
  balances?: { companyId: string; companyName: string | null; amount: Prisma.Decimal }[];
  cheques?: number;
  ledgerError?: unknown;
}

function build(setup: Setup = {}) {
  const sqls: string[] = [];
  const queryRaw = jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    sqls.push(sql);
    if (sql.includes('FROM public.companys')) return Promise.resolve(setup.companyLive === false ? [] : [{ comp_id: COMPANY }]);
    if (sql.includes('FROM public.user_menus')) return Promise.resolve([{ ...ALL_RIGHTS, ...(setup.rights ?? {}) }]);
    if (sql.includes('SELECT trn_id FROM public.transporter_master')) return Promise.resolve(setup.dup ? [{ trn_id: 'x' }] : []);
    if (sql.includes('FROM fixed.state_codes')) return Promise.resolve(setup.stateOk === false ? [] : [{ state_name: 'Tamil Nadu' }]);
    if (sql.includes('LEFT JOIN fixed.state_codes s')) return Promise.resolve([payloadRow]);
    return Promise.resolve([]);
  });
  const transporterMaster = {
    findFirst: jest.fn().mockResolvedValue(setup.existing === undefined ? storedRow() : setup.existing),
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(storedRow({ ...data }))),
    update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(storedRow({ ...data }))),
  };
  const accLedgerMaster = {
    findFirst: jest.fn().mockResolvedValue({ ledGroupId: OLD_GROUP }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const tx = { $queryRaw: queryRaw, transporterMaster, accLedgerMaster };
  const prisma = { ...tx, $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)) };
  const ctx = { getUserId: () => USER, getCompanyId: () => (setup.company === undefined ? COMPANY : setup.company) };
  const audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
  const ledgers = {
    createLedgerWithinTx: jest.fn(() => (setup.ledgerError ? Promise.reject(setup.ledgerError) : Promise.resolve({ ledId: TRN }))),
    updateLedgerWithinTx: jest.fn(() => (setup.ledgerError ? Promise.reject(setup.ledgerError) : Promise.resolve({ ledId: TRN }))),
  };
  const party = {
    lockLedger: jest.fn().mockResolvedValue({ ledCompanyId: COMPANY, ledIsDeleted: false }),
    balances: jest.fn().mockResolvedValue(setup.balances ?? []),
    chequesInHand: jest.fn().mockResolvedValue(setup.cheques ?? 0),
  };
  const service = new TransporterService(prisma as never, ctx as never, audit as never, ledgers as never, party as never);
  return { service, transporterMaster, accLedgerMaster, ledgers, party, audit, sqls };
}

const dto = (over: Partial<SaveTransporterDto> = {}): SaveTransporterDto => ({
  companyId: COMPANY, name: '  KPN   Parcel Service ', ...over,
});

async function refusal(p: Promise<unknown>): Promise<{ status: number; code: string | undefined; line?: string }> {
  const e = await p.then(() => { throw new Error('expected a refusal'); }, (x: unknown) => x);
  if (!(e instanceof HttpException)) throw e;
  const body = e.getResponse() as { errors?: { code?: string; user?: { line?: string } }[] };
  return { status: e.getStatus(), code: body.errors?.[0]?.code };
}

const LEDGER_TAKEN = new ConflictException({
  success: false,
  message: 'Account ledger name already exists',
  errors: [{ field: 'ledName', message: 'Duplicate', code: 'LEDGER_NAME_TAKEN' }],
});

describe('transporterLedgerFields (D32)', () => {
  const base = {
    name: 'KPN', companyId: COMPANY, stateCode: '33', stateName: 'Tamil Nadu', phone: '0422', email: 'a@b.c',
    addr: '12 Road', place: 'Coimbatore', pin: '641004', isActive: true,
  };
  it('a GSTIN: REGULAR, copied, bill-by-bill, group Transporters, contact copied', () => {
    expect(transporterLedgerFields({ ...base, gstin: '33ABCDE1234F1Z5', isEnrolmentId: false })).toEqual({
      ledGroupId: TRANSPORTER_LEDGER_GROUP_ID, ledName: 'KPN', ledCompanyId: COMPANY, ledIsBillByBill: true,
      ledGstPartyRegType: 'REGULAR', ledIsSez: false, ledGstinNo: '33ABCDE1234F1Z5', ledStateCode: '33',
      ledStateName: 'Tamil Nadu', ledPhone1: '0422', ledEmail: 'a@b.c', ledAddr1: '12 Road', ledCity: 'Coimbatore',
      ledPin: '641004', ledIsActive: true,
    });
  });
  it('a TRANSIN or none: UNREGISTERED, no GSTIN on the ledger', () => {
    for (const t of [{ gstin: 'AB12CD34EF56GH7', isEnrolmentId: true }, { gstin: null, isEnrolmentId: false }]) {
      expect(transporterLedgerFields({ ...base, ...t })).toMatchObject({ ledGstPartyRegType: 'UNREGISTERED', ledGstinNo: null, ledIsSez: false });
    }
  });
});

describe('isLedgerNameTaken', () => {
  it('knows the ledger service refusal and a unique violation, nothing else', () => {
    expect(isLedgerNameTaken(LEDGER_TAKEN)).toBe(true);
    expect(isLedgerNameTaken(new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }))).toBe(true);
    expect(isLedgerNameTaken(new ConflictException({ errors: [{ code: 'TRN_NAME_TAKEN' }] }))).toBe(false);
    expect(isLedgerNameTaken(new Error('x'))).toBe(false);
  });
});

describe('TransporterService.save', () => {
  it('create: makes the ledger first, then the row with trn_id = trn_ledger_id = led_id (D31)', async () => {
    const { service, ledgers, transporterMaster, audit } = build();
    const out = await service.save(dto({ gstin: ' 33abcde1234f1z5 ', stateCode: '33', mode: 'RAIL' }));
    const ledgerDto = (ledgers.createLedgerWithinTx.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(ledgerDto).toMatchObject({ ledGroupId: TRANSPORTER_LEDGER_GROUP_ID, ledName: 'KPN Parcel Service', ledGstinNo: '33ABCDE1234F1Z5', ledStateName: 'Tamil Nadu' });
    const data = transporterMaster.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ trnId: TRN, trnLedgerId: TRN, trnName: 'KPN Parcel Service', trnGstin: '33ABCDE1234F1Z5', trnMode: 'RAIL', trnCompanyId: COMPANY });
    expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({ action: 'New', screenName: 'Transporter Master' });
    expect(out).toMatchObject({ ledgerId: TRN, ledgerGroupName: 'Transporters', stateName: 'Tamil Nadu', vehicleCount: 2 });
  });

  it('update: the ledger follows with its own group kept; Active off reaches the ledger', async () => {
    const { service, ledgers, transporterMaster } = build();
    await service.save(dto({ trnId: TRN, name: 'KPN Parcels', isActive: false }));
    expect(transporterMaster.update).toHaveBeenCalled();
    expect(ledgers.createLedgerWithinTx).not.toHaveBeenCalled();
    expect((ledgers.updateLedgerWithinTx.mock.calls[0] as unknown[])[0]).toMatchObject({ ledId: TRN, ledGroupId: OLD_GROUP, ledName: 'KPN Parcels', ledIsActive: false });
  });

  it('LEDGER_NAME_TAKEN from the ledger service -> 409 TRN_LEDGER_NAME_TAKEN, nothing written (D33)', async () => {
    const { service, transporterMaster } = build({ ledgerError: LEDGER_TAKEN });
    expect(await refusal(service.save(dto()))).toEqual({ status: 409, code: TransporterErrorCode.LEDGER_NAME_TAKEN });
    expect(transporterMaster.create).not.toHaveBeenCalled();
    expect(await refusal(build({ ledgerError: LEDGER_TAKEN }).service.save(dto({ trnId: TRN, name: 'Other' })))).toEqual({ status: 409, code: TransporterErrorCode.LEDGER_NAME_TAKEN });
  });

  it('refusals: name, GSTIN, state, duplicate, company, missing row', async () => {
    expect(await refusal(build().service.save(dto({ name: '   ' })))).toEqual({ status: 422, code: TransporterErrorCode.NAME_REQUIRED });
    expect(await refusal(build().service.save(dto({ gstin: '33ABCDE1234' })))).toEqual({ status: 422, code: TransporterErrorCode.GSTIN_INVALID });
    expect(await refusal(build().service.save(dto({ gstin: 'ABABCDE1234F1Z5' })))).toEqual({ status: 422, code: TransporterErrorCode.GSTIN_INVALID });
    await expect(build().service.save(dto({ gstin: 'ABABCDE1234F1Z5', isEnrolmentId: true }))).resolves.toBeDefined();
    expect(await refusal(build({ stateOk: false }).service.save(dto({ stateCode: '99' })))).toEqual({ status: 422, code: TransporterErrorCode.STATE_INVALID });
    expect(await refusal(build({ dup: true }).service.save(dto()))).toEqual({ status: 409, code: TransporterErrorCode.NAME_TAKEN });
    expect(await refusal(build().service.save(dto({ companyId: OTHER_COMPANY })))).toEqual({ status: 403, code: TransporterErrorCode.COMPANY_MISMATCH });
    expect(await refusal(build({ company: null, companyLive: false }).service.save(dto()))).toEqual({ status: 403, code: TransporterErrorCode.COMPANY_MISMATCH });
    await expect(build({ company: null }).service.save(dto())).resolves.toBeDefined();
    expect(await refusal(build({ existing: null }).service.save(dto({ trnId: TRN })))).toEqual({ status: 404, code: TransporterErrorCode.NOT_FOUND });
  });

  it('an update that keeps its name (any case) is not re-checked (D24)', async () => {
    const { service, sqls } = build({ dup: true });
    await service.save(dto({ trnId: TRN, name: 'kpn parcel service' }));
    expect(sqls.some((s) => s.includes('SELECT trn_id FROM public.transporter_master'))).toBe(false);
  });

  it('rights: TRN_RIGHT_CREATE / _EDIT / _VIEW / _DELETE', async () => {
    expect(await refusal(build({ rights: { um_can_create: false } }).service.save(dto()))).toEqual({ status: 403, code: 'TRN_RIGHT_CREATE' });
    expect(await refusal(build({ rights: { um_can_edit: false } }).service.save(dto({ trnId: TRN })))).toEqual({ status: 403, code: 'TRN_RIGHT_EDIT' });
    expect(await refusal(build({ rights: { um_can_view: false } }).service.getById(TRN))).toEqual({ status: 403, code: 'TRN_RIGHT_VIEW' });
    expect(await refusal(build({ rights: { um_can_delete: false } }).service.softDelete(TRN))).toEqual({ status: 403, code: 'TRN_RIGHT_DELETE' });
  });
});

describe('TransporterService.softDelete (D34)', () => {
  it('refused while the ledger has a balance, with the figure in the server line', async () => {
    const { service, transporterMaster } = build({
      balances: [{ companyId: COMPANY, companyName: 'Acme Foods', amount: new Prisma.Decimal('4250') }],
    });
    const e = await service.softDelete(TRN).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ConflictException);
    const err = ((e as ConflictException).getResponse() as { errors: { code: string; message: string }[] }).errors[0];
    expect(err.code).toBe(TransporterErrorCode.HAS_BALANCE);
    expect(err.message).toContain('4250.00 DR');
    expect(transporterMaster.update).not.toHaveBeenCalled();
  });

  it('refused while a cheque is in hand', async () => {
    expect(await refusal(build({ cheques: 1 }).service.softDelete(TRN))).toEqual({ status: 409, code: TransporterErrorCode.HAS_CHEQUE_IN_HAND });
  });

  it('at zero: the transporter and its ledger are soft-deleted together', async () => {
    const { service, transporterMaster, accLedgerMaster, party, audit } = build();
    expect(await service.softDelete(TRN)).toEqual({ trnId: TRN, deleted: true, name: 'KPN Parcel Service' });
    expect(party.lockLedger).toHaveBeenCalledWith(expect.anything(), TRN);
    expect(transporterMaster.update.mock.calls[0][0].data).toMatchObject({ trnIsDeleted: true, trnIsActive: false });
    expect(accLedgerMaster.updateMany.mock.calls[0][0]).toMatchObject({ where: { ledId: TRN, ledIsDeleted: false }, data: { ledIsDeleted: true, ledIsActive: false } });
    expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({ action: 'cancel', pk: TRN });
  });

  it('404 for a missing row', async () => {
    expect(await refusal(build({ existing: null }).service.softDelete(TRN))).toEqual({ status: 404, code: TransporterErrorCode.NOT_FOUND });
  });
});
