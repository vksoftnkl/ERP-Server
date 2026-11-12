import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { cleanVehicleNo, VehicleService } from './vehicle.service';
import type { SaveVehicleDto } from './dto/save-vehicle.dto';
import { VehicleErrorCode } from './types/vehicle-error-codes';

const COMPANY = '019c6f6c-be87-7a11-8905-36092c46e301';
const OTHER_COMPANY = '019c6f6c-be87-7a11-8905-36092c46e302';
const USER = '019c6f6c-be87-7a11-8905-36092c46e303';
const VEH = '019c6f6c-be87-7a11-8905-36092c46e304';
const TRN = '019c6f6c-be87-7a11-8905-36092c46e305';
const EMP = '019c6f6c-be87-7a11-8905-36092c46e306';
const BR = '019c6f6c-be87-7a11-8905-36092c46e307';

const ALL_RIGHTS = {
  um_can_view: true, um_can_create: true, um_can_edit: true, um_can_delete: true,
  um_can_print: true, um_can_export: true, um_can_post: false, um_can_cancel: false,
  um_can_amend: false, um_can_override: false, um_can_retender: false,
};

const storedRow = (over: Record<string, unknown> = {}) => ({
  vehId: VEH, vehCompanyId: COMPANY, vehBranchId: null, vehVehicleNo: 'TN38AB1234', vehType: 'REGULAR',
  vehDescription: null, vehCapacityKg: null, vehIsOwn: true, vehTransporterId: null, vehDriverId: null,
  vehIsActive: true, vehIsDeleted: false, vehSyncDate: null, vehCreatedOn: new Date(), vehCreatedBy: USER,
  vehModifiedOn: null, vehModifiedBy: null, ...over,
});

const payloadRow = {
  veh_id: VEH, veh_company_id: COMPANY, veh_branch_id: null, br_name: null, veh_vehicle_no: 'TN38AB1234',
  veh_type: 'REGULAR', veh_description: null, veh_capacity_kg: new Prisma.Decimal('7500.000'), veh_is_own: true,
  veh_transporter_id: null, trn_name: null, veh_driver_id: null, emp_name: null, emp_mobile1: null,
  veh_is_active: true, veh_created_by: USER, veh_created_on: new Date('2026-11-12T05:00:00Z'),
  veh_modified_by: null, veh_modified_on: null,
};

interface Setup {
  companyLive?: boolean;
  rights?: Partial<typeof ALL_RIGHTS> | null;
  company?: string | null;
  existing?: ReturnType<typeof storedRow> | null;
  dup?: boolean;
  transporterOk?: boolean;
  driverOk?: boolean;
  branchOk?: boolean;
}

function build(setup: Setup = {}) {
  const sqls: string[] = [];
  const queryRaw = jest.fn((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    sqls.push(sql);
    if (sql.includes('FROM public.companys')) return Promise.resolve(setup.companyLive === false ? [] : [{ comp_id: COMPANY }]);
    if (sql.includes('FROM public.user_menus')) {
      return Promise.resolve(setup.rights === null ? [] : [{ ...ALL_RIGHTS, ...(setup.rights ?? {}) }]);
    }
    if (sql.includes('SELECT veh_id FROM public.vehicle_master')) return Promise.resolve(setup.dup ? [{ veh_id: 'x' }] : []);
    if (sql.includes('FROM public.transporter_master')) return Promise.resolve(setup.transporterOk === false ? [] : [{ trn_id: TRN }]);
    if (sql.includes('FROM public.employee_master')) return Promise.resolve(setup.driverOk === false ? [] : [{ emp_id: EMP }]);
    if (sql.includes('FROM public.branch_master')) return Promise.resolve(setup.branchOk === false ? [] : [{ br_id: BR }]);
    if (sql.includes('LEFT JOIN public.transporter_master t')) return Promise.resolve([payloadRow]);
    return Promise.resolve([]);
  });
  const vehicleMaster = {
    findFirst: jest.fn().mockResolvedValue(setup.existing === undefined ? storedRow() : setup.existing),
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(storedRow({ ...data }))),
    update: jest.fn(({ data }: { data: Record<string, unknown> }) => Promise.resolve(storedRow({ ...data }))),
  };
  const tx = { $queryRaw: queryRaw, vehicleMaster };
  const prisma = {
    ...tx,
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const ctx = {
    getUserId: () => USER,
    getCompanyId: () => (setup.company === undefined ? COMPANY : setup.company),
  };
  const audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
  const service = new VehicleService(prisma as never, ctx as never, audit as never);
  return { service, prisma, vehicleMaster, audit, sqls };
}

const dto = (over: Partial<SaveVehicleDto> = {}): SaveVehicleDto => ({
  companyId: COMPANY, vehicleNo: 'tn 38 ab-1234', type: 'REGULAR', ...over,
});

async function refusal(p: Promise<unknown>): Promise<{ status: number; code: string | undefined }> {
  const e = await p.then(() => { throw new Error('expected a refusal'); }, (x: unknown) => x);
  if (!(e instanceof HttpException)) throw e;
  const body = e.getResponse() as { errors?: { code?: string }[] };
  return { status: e.getStatus(), code: body.errors?.[0]?.code };
}

describe('cleanVehicleNo (D9)', () => {
  it.each([
    ['tn 38 ab-1234', 'TN38AB1234'],
    ['zt 01-vm.0002', 'ZT01VM0002'],
    ['ka/01/ab/9876', 'KA01AB9876'],
    [' - ', ''],
    [null, ''],
  ])('%p -> %p', (raw, clean) => expect(cleanVehicleNo(raw as string | null)).toBe(clean));
});

describe('VehicleService.save', () => {
  it('creates with the cleaned number, the login company, audit "New" and the get payload', async () => {
    const { service, vehicleMaster, audit } = build();
    const out = await service.save(dto({ capacityKg: 7500.5, description: '  Tata 1109  ' }));
    const data = vehicleMaster.create.mock.calls[0][0].data;
    expect(data.vehVehicleNo).toBe('TN38AB1234');
    expect(data.vehCompanyId).toBe(COMPANY);
    expect(data.vehDescription).toBe('Tata 1109');
    expect(data.vehCapacityKg).toEqual(new Prisma.Decimal('7500.5'));
    expect(data.vehCreatedBy).toBe(USER);
    expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({ action: 'New', screenName: 'Vehicle Master', screenType: 'master' });
    expect(Object.keys(out).sort()).toEqual([
      'branchId', 'branchName', 'capacityKg', 'companyId', 'createdBy', 'createdOn', 'description', 'driverId',
      'driverMobile', 'driverName', 'isActive', 'isOwn', 'modifiedBy', 'modifiedOn', 'transporterId',
      'transporterName', 'type', 'vehId', 'vehicleNo',
    ]);
    expect(out.capacityKg).toBe(7500);
  });

  it.each([' - ', '', '...'])('refuses an empty number %p with VEH_NO_REQUIRED', async (no) => {
    expect(await refusal(build().service.save(dto({ vehicleNo: no })))).toEqual({ status: 422, code: VehicleErrorCode.NO_REQUIRED });
  });

  it.each(['ZT1', 'A'.repeat(21), 'ZT01#1'])('refuses %p with VEH_NO_INVALID', async (no) => {
    expect(await refusal(build().service.save(dto({ vehicleNo: no })))).toEqual({ status: 422, code: VehicleErrorCode.NO_INVALID });
  });

  it('a user bound to a company may only save for it: 403 VEH_COMPANY_MISMATCH', async () => {
    expect(await refusal(build().service.save(dto({ companyId: OTHER_COMPANY })))).toEqual({ status: 403, code: VehicleErrorCode.COMPANY_MISMATCH });
    await expect(build().service.save(dto({ companyId: COMPANY.toUpperCase() }))).resolves.toBeDefined();
  });

  it('a user bound to no company (VKPOS) saves for any live company, not a missing one', async () => {
    const ok = build({ company: null });
    await ok.service.save(dto());
    expect(ok.vehicleMaster.create.mock.calls[0][0].data.vehCompanyId).toBe(COMPANY);
    expect(await refusal(build({ company: null, companyLive: false }).service.save(dto()))).toEqual({ status: 403, code: VehicleErrorCode.COMPANY_MISMATCH });
  });

  it('an update looks the row up in the body company', async () => {
    const { service, vehicleMaster } = build({ company: null });
    await service.save(dto({ vehId: VEH }));
    expect(vehicleMaster.findFirst.mock.calls[0][0].where).toMatchObject({ vehId: VEH, vehCompanyId: COMPANY });
  });

  it('refuses a taken number on create with 409 VEH_NO_TAKEN', async () => {
    expect(await refusal(build({ dup: true }).service.save(dto()))).toEqual({ status: 409, code: VehicleErrorCode.NO_TAKEN });
  });

  it('does not re-check an update that keeps its number (D24)', async () => {
    const { service, sqls, vehicleMaster } = build({ dup: true });
    await service.save(dto({ vehId: VEH, description: 'new words' }));
    expect(sqls.some((s) => s.includes('SELECT veh_id FROM public.vehicle_master'))).toBe(false);
    expect(vehicleMaster.update).toHaveBeenCalled();
  });

  it('refuses an update that renames onto a taken number', async () => {
    expect(await refusal(build({ dup: true }).service.save(dto({ vehId: VEH, vehicleNo: 'TN99ZZ0001' })))).toEqual({ status: 409, code: VehicleErrorCode.NO_TAKEN });
  });

  it('answers 404 VEH_NOT_FOUND for an update of a missing row', async () => {
    expect(await refusal(build({ existing: null }).service.save(dto({ vehId: VEH })))).toEqual({ status: 404, code: VehicleErrorCode.NOT_FOUND });
  });

  it('stores no transporter for an own vehicle and does not look it up (D23)', async () => {
    const { service, vehicleMaster, sqls } = build({ transporterOk: false });
    await service.save(dto({ isOwn: true, transporterId: TRN }));
    expect(vehicleMaster.create.mock.calls[0][0].data.vehTransporterId).toBeNull();
    expect(sqls.some((s) => s.includes('SELECT trn_id FROM public.transporter_master'))).toBe(false);
  });

  it('keeps the transporter of a hired vehicle', async () => {
    const { service, vehicleMaster } = build();
    await service.save(dto({ isOwn: false, transporterId: TRN }));
    expect(vehicleMaster.create.mock.calls[0][0].data).toMatchObject({ vehIsOwn: false, vehTransporterId: TRN });
  });

  it('refuses a bad transporter / driver / branch with 422', async () => {
    expect(await refusal(build({ transporterOk: false }).service.save(dto({ isOwn: false, transporterId: TRN })))).toEqual({ status: 422, code: VehicleErrorCode.TRANSPORTER_INVALID });
    expect(await refusal(build({ driverOk: false }).service.save(dto({ driverId: EMP })))).toEqual({ status: 422, code: VehicleErrorCode.DRIVER_INVALID });
    expect(await refusal(build({ branchOk: false }).service.save(dto({ branchId: BR })))).toEqual({ status: 422, code: VehicleErrorCode.BRANCH_INVALID });
  });

  it('needs Create for a new one and Edit for a change', async () => {
    expect(await refusal(build({ rights: { um_can_create: false } }).service.save(dto()))).toEqual({ status: 403, code: 'VEH_RIGHT_CREATE' });
    expect(await refusal(build({ rights: { um_can_edit: false } }).service.save(dto({ vehId: VEH })))).toEqual({ status: 403, code: 'VEH_RIGHT_EDIT' });
    expect(await refusal(build({ rights: null }).service.save(dto()))).toEqual({ status: 403, code: 'VEH_RIGHT_CREATE' });
  });
});

describe('VehicleService.getById / softDelete', () => {
  it('needs View to open, and answers 404 for another company / missing row', async () => {
    expect(await refusal(build({ rights: { um_can_view: false } }).service.getById(VEH))).toEqual({ status: 403, code: 'VEH_RIGHT_VIEW' });
    expect(await refusal(build({ existing: null }).service.getById(VEH))).toEqual({ status: 404, code: VehicleErrorCode.NOT_FOUND });
    const { service, vehicleMaster } = build();
    expect((await service.getById(VEH)).vehicleNo).toBe('TN38AB1234');
    expect(vehicleMaster.findFirst.mock.calls[0][0].where).toMatchObject({ vehId: VEH, vehIsDeleted: false, vehCompanyId: COMPANY });
  });

  it('soft deletes (deleted + inactive) with an audit entry, needing Delete', async () => {
    expect(await refusal(build({ rights: { um_can_delete: false } }).service.softDelete(VEH))).toEqual({ status: 403, code: 'VEH_RIGHT_DELETE' });
    expect(await refusal(build({ existing: null }).service.softDelete(VEH))).toEqual({ status: 404, code: VehicleErrorCode.NOT_FOUND });
    const { service, vehicleMaster, audit } = build();
    expect(await service.softDelete(VEH)).toEqual({ vehId: VEH, deleted: true, vehicleNo: 'TN38AB1234' });
    expect(vehicleMaster.update.mock.calls[0][0].data).toMatchObject({ vehIsDeleted: true, vehIsActive: false });
    expect(audit.logEntityChange.mock.calls[0][0]).toMatchObject({ action: 'cancel', pk: VEH });
  });
});
