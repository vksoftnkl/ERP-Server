import { Injectable } from '@nestjs/common';
import { Prisma, type VehicleMaster } from '@prisma/client';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  throwConflict,
  throwForbidden,
  throwNotFound,
  throwUnprocessable,
  type ModuleErrorDetail,
} from 'src/common/utils/module-shared.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { SaveVehicleDto } from './dto/save-vehicle.dto';
import { VEHICLE_RIGHT_PREFIX, VehicleErrorCode } from './types/vehicle-error-codes';

/**
 * Vehicle Master (menu 125 under Sales Masters; plan-vehicle-master-2026-11-11 §5.1).
 * A vehicle belongs to the login company (D2); the number is kept as the e-way bill
 * portal stores it: capitals, letters and digits only (D9, ck_veh_no). The DB index
 * on the number is plain (D11, offline rule), so the same number twice is refused
 * here, online, and only on a create or on an update that changes it (D24).
 */
export const VEHICLE_MENU_ID = 125;
export const VEHICLE_AUDIT_SCREEN_NAME = 'Vehicle Master';
export const VEHICLE_TABLE_NAME = 'public.vehicle_master';

const VEHICLE_NO_PATTERN = /^[A-Z0-9]{4,20}$/;

/** D9: 'tn 38 ab-1234' → 'TN38AB1234' (capitals; spaces, hyphens, dots and slashes out). */
export function cleanVehicleNo(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[\s\-./]+/g, '');
}

export interface VehiclePayload {
  vehId: string;
  companyId: string | null;
  branchId: string | null;
  branchName: string | null;
  vehicleNo: string;
  type: string;
  description: string | null;
  capacityKg: number | null;
  isOwn: boolean;
  transporterId: string | null;
  transporterName: string | null;
  driverId: string | null;
  driverName: string | null;
  driverMobile: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdOn: string | null;
  modifiedBy: string | null;
  modifiedOn: string | null;
}

interface VehicleRow {
  veh_id: string;
  veh_company_id: string | null;
  veh_branch_id: string | null;
  br_name: string | null;
  veh_vehicle_no: string;
  veh_type: string;
  veh_description: string | null;
  veh_capacity_kg: Prisma.Decimal | null;
  veh_is_own: boolean;
  veh_transporter_id: string | null;
  trn_name: string | null;
  veh_driver_id: string | null;
  emp_name: string | null;
  emp_mobile1: string | null;
  veh_is_active: boolean;
  veh_created_by: string | null;
  veh_created_on: Date | null;
  veh_modified_by: string | null;
  veh_modified_on: Date | null;
}

type Client = Prisma.TransactionClient | PrismaService;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

@Injectable()
export class VehicleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: RequestContextService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private actor(): string {
    return this.ctx.getUserId() ?? DEFAULT_ACTOR;
  }

  private assertRight(client: Client, right: MenuRight, action: string): Promise<unknown> {
    return assertMenuRight(client, {
      userId: this.ctx.getUserId() ?? null,
      menuId: VEHICLE_MENU_ID,
      right,
      codePrefix: VEHICLE_RIGHT_PREFIX,
      action,
    });
  }

  /** The login company; a body naming another one is refused (D25). */
  /**
   * The token's company: the user's own company (user_master.usr_company_id), or null
   * for a user bound to none (a super admin working in several companies, e.g. VKPOS).
   */
  private loginCompany(): string | null {
    return this.ctx.getCompanyId()?.toLowerCase() ?? null;
  }

  /**
   * D25 as built: the body's company is the one saved for. A user bound to a company may
   * only name that one; a user bound to none may name any live company.
   */
  private async resolveCompany(client: Client, bodyCompanyId: string): Promise<string> {
    const token = this.loginCompany();
    const body = bodyCompanyId.toLowerCase();
    let refusal: string | null = null;
    if (token && token !== body) {
      refusal = `companyId ${body} is not the login company ${token}`;
    } else if (!token) {
      const [c] = await client.$queryRaw<{ comp_id: string }[]>`
        SELECT comp_id FROM public.companys
         WHERE comp_id = ${body}::uuid AND coalesce(comp_is_deleted, false) = false`;
      if (!c) {
        refusal = `companyId ${body} is not a live company`;
      }
    }
    if (refusal) {
      throwForbidden<ModuleErrorDetail>('Vehicle belongs to another company', [
        { field: 'companyId', message: refusal, code: VehicleErrorCode.COMPANY_MISMATCH },
      ]);
    }
    return body;
  }

  private refuse(code: VehicleErrorCode, field: string, message: string): never {
    throwUnprocessable<ModuleErrorDetail>(message, [{ field, message, code }]);
  }

  private notFound(vehId: string): never {
    throwNotFound<ModuleErrorDetail>(
      'Vehicle not found',
      'vehId',
      `No live vehicle of this company with id ${vehId}`,
      VehicleErrorCode.NOT_FOUND,
    );
  }

  /**
   * The live row or 404 VEH_NOT_FOUND. Scoped to `company` (a save names it), else to
   * the token's company; a user bound to no company reaches every company's row.
   */
  private async loadLive(client: Client, vehId: string, company: string | null = this.loginCompany()): Promise<VehicleMaster> {
    const row = await client.vehicleMaster.findFirst({
      where: { vehId, vehIsDeleted: false, ...(company ? { vehCompanyId: company } : {}) },
    });
    if (!row) {
      this.notFound(vehId);
    }
    return row;
  }

  async save(dto: SaveVehicleDto): Promise<VehiclePayload> {
    const isCreate = !dto.vehId;
    const id = await this.prisma.$transaction(
      async (tx) => {
        // 1 · the right
        await this.assertRight(tx, isCreate ? 'create' : 'edit', isCreate ? 'make vehicles' : 'change vehicles');
        // 2 · the company (D25)
        const company = await this.resolveCompany(tx, dto.companyId);
        // 3 · the number (D9)
        const vehicleNo = cleanVehicleNo(dto.vehicleNo);
        if (!vehicleNo) {
          this.refuse(VehicleErrorCode.NO_REQUIRED, 'vehicleNo', 'The vehicle number is empty');
        }
        if (!VEHICLE_NO_PATTERN.test(vehicleNo)) {
          this.refuse(
            VehicleErrorCode.NO_INVALID,
            'vehicleNo',
            `${vehicleNo} is not 4 to 20 letters and digits`,
          );
        }
        // 4 · update: the row must be there
        const existing = isCreate ? null : await this.loadLive(tx, dto.vehId!, company);
        // 5 · the same number twice in this company — only when it is new or changed (D24)
        if (isCreate || existing!.vehVehicleNo !== vehicleNo) {
          const [dup] = await tx.$queryRaw<{ veh_id: string }[]>`
            SELECT veh_id FROM public.vehicle_master
             WHERE veh_company_id = ${company}::uuid
               AND veh_vehicle_no = ${vehicleNo}
               AND veh_is_deleted = false
               AND (${dto.vehId ?? null}::uuid IS NULL OR veh_id <> ${dto.vehId ?? null}::uuid)
             LIMIT 1`;
          if (dup) {
            throwConflict<ModuleErrorDetail>('Vehicle number already used', [
              {
                field: 'vehicleNo',
                message: `A vehicle ${vehicleNo} already exists for this company`,
                code: VehicleErrorCode.NO_TAKEN,
              },
            ]);
          }
        }
        // 6 · own vehicle: no transporter (D23); hired: a live active one, if given
        const isOwn = dto.isOwn ?? true;
        const transporterId = isOwn ? null : (dto.transporterId ?? null);
        if (transporterId) {
          const [trn] = await tx.$queryRaw<{ trn_id: string }[]>`
            SELECT trn_id FROM public.transporter_master
             WHERE trn_id = ${transporterId}::uuid
               AND trn_is_deleted = false AND trn_is_active = true
               AND (trn_company_id IS NULL OR trn_company_id = ${company}::uuid)`;
          if (!trn) {
            this.refuse(
              VehicleErrorCode.TRANSPORTER_INVALID,
              'transporterId',
              `Transporter ${transporterId} is not a live, active transporter of this company`,
            );
          }
        }
        // 7 · the driver: a live, active employee of this company
        const driverId = dto.driverId ?? null;
        if (driverId) {
          const [emp] = await tx.$queryRaw<{ emp_id: string }[]>`
            SELECT emp_id FROM public.employee_master
             WHERE emp_id = ${driverId}::uuid
               AND emp_is_deleted = false AND emp_is_active = true
               AND emp_company_id = ${company}::uuid`;
          if (!emp) {
            this.refuse(
              VehicleErrorCode.DRIVER_INVALID,
              'driverId',
              `Employee ${driverId} is not a live, active employee of this company`,
            );
          }
        }
        // 8 · the home branch: a live branch of this company
        const branchId = dto.branchId ?? null;
        if (branchId) {
          const [br] = await tx.$queryRaw<{ br_id: string }[]>`
            SELECT br_id FROM public.branch_master
             WHERE br_id = ${branchId}::uuid
               AND br_is_deleted = false
               AND br_comp_id = ${company}::uuid`;
          if (!br) {
            this.refuse(
              VehicleErrorCode.BRANCH_INVALID,
              'branchId',
              `Branch ${branchId} is not a branch of this company`,
            );
          }
        }
        // 10 · write + audit, one transaction
        const data = {
          vehCompanyId: company,
          vehBranchId: branchId,
          vehVehicleNo: vehicleNo,
          vehType: dto.type,
          vehDescription: dto.description?.trim() ? dto.description.trim() : null,
          vehCapacityKg:
            dto.capacityKg === null || dto.capacityKg === undefined
              ? null
              : new Prisma.Decimal(String(dto.capacityKg)),
          vehIsOwn: isOwn,
          vehTransporterId: transporterId,
          vehDriverId: driverId,
          vehIsActive: dto.isActive ?? true,
        };
        const saved = isCreate
          ? await tx.vehicleMaster.create({ data: { ...data, vehCreatedBy: this.actor() } })
          : await tx.vehicleMaster.update({
              where: { vehId: dto.vehId },
              data: { ...data, vehModifiedBy: this.actor(), vehModifiedOn: new Date() },
            });
        await this.auditLogService.logEntityChange(
          {
            action: isCreate ? 'New' : 'update',
            tableName: VEHICLE_TABLE_NAME,
            screenName: VEHICLE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: saved.vehId,
            displayName: saved.vehVehicleNo,
            originalRecord: existing,
            modifiedRecord: saved,
            userId: this.actor(),
            notes: isCreate ? 'Vehicle created' : 'Vehicle updated',
          },
          tx,
        );
        return saved.vehId;
      },
      { timeout: 30000, maxWait: 10000 },
    );
    return this.load(this.prisma, id);
  }

  async getById(vehId: string): Promise<VehiclePayload> {
    await this.assertRight(this.prisma, 'view', 'open vehicles');
    await this.loadLive(this.prisma, vehId);
    return this.load(this.prisma, vehId);
  }

  async softDelete(vehId: string): Promise<{ vehId: string; deleted: true; vehicleNo: string }> {
    return this.prisma.$transaction(async (tx) => {
      await this.assertRight(tx, 'delete', 'delete vehicles');
      const existing = await this.loadLive(tx, vehId);
      // Documents keep *_vehicle_no and their FK (D8).
      const saved = await tx.vehicleMaster.update({
        where: { vehId },
        data: { vehIsDeleted: true, vehIsActive: false, vehModifiedBy: this.actor(), vehModifiedOn: new Date() },
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: VEHICLE_TABLE_NAME,
          screenName: VEHICLE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: vehId,
          displayName: existing.vehVehicleNo,
          originalRecord: existing,
          modifiedRecord: saved,
          userId: this.actor(),
          notes: 'Vehicle soft deleted',
        },
        tx,
      );
      return { vehId, deleted: true as const, vehicleNo: existing.vehVehicleNo };
    });
  }

  /** The get payload (plan §5.1), names joined. */
  private async load(client: Client, vehId: string): Promise<VehiclePayload> {
    const [r] = await client.$queryRaw<VehicleRow[]>`
      SELECT v.veh_id, v.veh_company_id, v.veh_branch_id, b.br_name, v.veh_vehicle_no, v.veh_type,
             v.veh_description, v.veh_capacity_kg, v.veh_is_own, v.veh_transporter_id, t.trn_name,
             v.veh_driver_id, e.emp_name, e.emp_mobile1, v.veh_is_active,
             v.veh_created_by, v.veh_created_on, v.veh_modified_by, v.veh_modified_on
        FROM public.vehicle_master v
        LEFT JOIN public.transporter_master t ON t.trn_id = v.veh_transporter_id
        LEFT JOIN public.employee_master   e ON e.emp_id = v.veh_driver_id
        LEFT JOIN public.branch_master     b ON b.br_id  = v.veh_branch_id
       WHERE v.veh_id = ${vehId}::uuid AND v.veh_is_deleted = false`;
    if (!r) {
      this.notFound(vehId);
    }
    return toVehiclePayload(r);
  }
}

export function toVehiclePayload(r: VehicleRow): VehiclePayload {
  return {
    vehId: r.veh_id,
    companyId: r.veh_company_id,
    branchId: r.veh_branch_id,
    branchName: r.br_name,
    vehicleNo: r.veh_vehicle_no,
    type: r.veh_type,
    description: r.veh_description,
    capacityKg: r.veh_capacity_kg === null ? null : Number(new Prisma.Decimal(r.veh_capacity_kg).toFixed(3)),
    isOwn: r.veh_is_own,
    transporterId: r.veh_transporter_id,
    transporterName: r.trn_name,
    driverId: r.veh_driver_id,
    driverName: r.emp_name,
    driverMobile: r.emp_mobile1,
    isActive: r.veh_is_active,
    createdBy: r.veh_created_by,
    createdOn: iso(r.veh_created_on),
    modifiedBy: r.veh_modified_by,
    modifiedOn: iso(r.veh_modified_on),
  };
}
