"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehicleService = exports.VEHICLE_TABLE_NAME = exports.VEHICLE_AUDIT_SCREEN_NAME = exports.VEHICLE_MENU_ID = void 0;
exports.cleanVehicleNo = cleanVehicleNo;
exports.toVehiclePayload = toVehiclePayload;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../../common/utils/module-shared.utils");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const vehicle_error_codes_1 = require("./types/vehicle-error-codes");
exports.VEHICLE_MENU_ID = 125;
exports.VEHICLE_AUDIT_SCREEN_NAME = 'Vehicle Master';
exports.VEHICLE_TABLE_NAME = 'public.vehicle_master';
const VEHICLE_NO_PATTERN = /^[A-Z0-9]{4,20}$/;
function cleanVehicleNo(raw) {
    return (raw ?? '').toUpperCase().replace(/[\s\-./]+/g, '');
}
const iso = (d) => (d ? d.toISOString() : null);
let VehicleService = class VehicleService {
    prisma;
    ctx;
    auditLogService;
    constructor(prisma, ctx, auditLogService) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.auditLogService = auditLogService;
    }
    actor() {
        return this.ctx.getUserId() ?? module_shared_utils_1.DEFAULT_ACTOR;
    }
    assertRight(client, right, action) {
        return (0, rights_1.assertMenuRight)(client, {
            userId: this.ctx.getUserId() ?? null,
            menuId: exports.VEHICLE_MENU_ID,
            right,
            codePrefix: vehicle_error_codes_1.VEHICLE_RIGHT_PREFIX,
            action,
        });
    }
    loginCompany() {
        return this.ctx.getCompanyId()?.toLowerCase() ?? null;
    }
    async resolveCompany(client, bodyCompanyId) {
        const token = this.loginCompany();
        const body = bodyCompanyId.toLowerCase();
        let refusal = null;
        if (token && token !== body) {
            refusal = `companyId ${body} is not the login company ${token}`;
        }
        else if (!token) {
            const [c] = await client.$queryRaw `
        SELECT comp_id FROM public.companys
         WHERE comp_id = ${body}::uuid AND coalesce(comp_is_deleted, false) = false`;
            if (!c) {
                refusal = `companyId ${body} is not a live company`;
            }
        }
        if (refusal) {
            (0, module_shared_utils_1.throwForbidden)('Vehicle belongs to another company', [
                { field: 'companyId', message: refusal, code: vehicle_error_codes_1.VehicleErrorCode.COMPANY_MISMATCH },
            ]);
        }
        return body;
    }
    refuse(code, field, message) {
        (0, module_shared_utils_1.throwUnprocessable)(message, [{ field, message, code }]);
    }
    notFound(vehId) {
        (0, module_shared_utils_1.throwNotFound)('Vehicle not found', 'vehId', `No live vehicle of this company with id ${vehId}`, vehicle_error_codes_1.VehicleErrorCode.NOT_FOUND);
    }
    async loadLive(client, vehId, company = this.loginCompany()) {
        const row = await client.vehicleMaster.findFirst({
            where: { vehId, vehIsDeleted: false, ...(company ? { vehCompanyId: company } : {}) },
        });
        if (!row) {
            this.notFound(vehId);
        }
        return row;
    }
    async save(dto) {
        const isCreate = !dto.vehId;
        const id = await this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, isCreate ? 'create' : 'edit', isCreate ? 'make vehicles' : 'change vehicles');
            const company = await this.resolveCompany(tx, dto.companyId);
            const vehicleNo = cleanVehicleNo(dto.vehicleNo);
            if (!vehicleNo) {
                this.refuse(vehicle_error_codes_1.VehicleErrorCode.NO_REQUIRED, 'vehicleNo', 'The vehicle number is empty');
            }
            if (!VEHICLE_NO_PATTERN.test(vehicleNo)) {
                this.refuse(vehicle_error_codes_1.VehicleErrorCode.NO_INVALID, 'vehicleNo', `${vehicleNo} is not 4 to 20 letters and digits`);
            }
            const existing = isCreate ? null : await this.loadLive(tx, dto.vehId, company);
            if (isCreate || existing.vehVehicleNo !== vehicleNo) {
                const [dup] = await tx.$queryRaw `
            SELECT veh_id FROM public.vehicle_master
             WHERE veh_company_id = ${company}::uuid
               AND veh_vehicle_no = ${vehicleNo}
               AND veh_is_deleted = false
               AND (${dto.vehId ?? null}::uuid IS NULL OR veh_id <> ${dto.vehId ?? null}::uuid)
             LIMIT 1`;
                if (dup) {
                    (0, module_shared_utils_1.throwConflict)('Vehicle number already used', [
                        {
                            field: 'vehicleNo',
                            message: `A vehicle ${vehicleNo} already exists for this company`,
                            code: vehicle_error_codes_1.VehicleErrorCode.NO_TAKEN,
                        },
                    ]);
                }
            }
            const isOwn = dto.isOwn ?? true;
            const transporterId = isOwn ? null : (dto.transporterId ?? null);
            if (transporterId) {
                const [trn] = await tx.$queryRaw `
            SELECT trn_id FROM public.transporter_master
             WHERE trn_id = ${transporterId}::uuid
               AND trn_is_deleted = false AND trn_is_active = true
               AND (trn_company_id IS NULL OR trn_company_id = ${company}::uuid)`;
                if (!trn) {
                    this.refuse(vehicle_error_codes_1.VehicleErrorCode.TRANSPORTER_INVALID, 'transporterId', `Transporter ${transporterId} is not a live, active transporter of this company`);
                }
            }
            const driverId = dto.driverId ?? null;
            if (driverId) {
                const [emp] = await tx.$queryRaw `
            SELECT emp_id FROM public.employee_master
             WHERE emp_id = ${driverId}::uuid
               AND emp_is_deleted = false AND emp_is_active = true
               AND emp_company_id = ${company}::uuid`;
                if (!emp) {
                    this.refuse(vehicle_error_codes_1.VehicleErrorCode.DRIVER_INVALID, 'driverId', `Employee ${driverId} is not a live, active employee of this company`);
                }
            }
            const branchId = dto.branchId ?? null;
            if (branchId) {
                const [br] = await tx.$queryRaw `
            SELECT br_id FROM public.branch_master
             WHERE br_id = ${branchId}::uuid
               AND br_is_deleted = false
               AND br_comp_id = ${company}::uuid`;
                if (!br) {
                    this.refuse(vehicle_error_codes_1.VehicleErrorCode.BRANCH_INVALID, 'branchId', `Branch ${branchId} is not a branch of this company`);
                }
            }
            const data = {
                vehCompanyId: company,
                vehBranchId: branchId,
                vehVehicleNo: vehicleNo,
                vehType: dto.type,
                vehDescription: dto.description?.trim() ? dto.description.trim() : null,
                vehCapacityKg: dto.capacityKg === null || dto.capacityKg === undefined
                    ? null
                    : new client_1.Prisma.Decimal(String(dto.capacityKg)),
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
            await this.auditLogService.logEntityChange({
                action: isCreate ? 'New' : 'update',
                tableName: exports.VEHICLE_TABLE_NAME,
                screenName: exports.VEHICLE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: saved.vehId,
                displayName: saved.vehVehicleNo,
                originalRecord: existing,
                modifiedRecord: saved,
                userId: this.actor(),
                notes: isCreate ? 'Vehicle created' : 'Vehicle updated',
            }, tx);
            return saved.vehId;
        }, { timeout: 30000, maxWait: 10000 });
        return this.load(this.prisma, id);
    }
    async getById(vehId) {
        await this.assertRight(this.prisma, 'view', 'open vehicles');
        await this.loadLive(this.prisma, vehId);
        return this.load(this.prisma, vehId);
    }
    async softDelete(vehId) {
        return this.prisma.$transaction(async (tx) => {
            await this.assertRight(tx, 'delete', 'delete vehicles');
            const existing = await this.loadLive(tx, vehId);
            const saved = await tx.vehicleMaster.update({
                where: { vehId },
                data: { vehIsDeleted: true, vehIsActive: false, vehModifiedBy: this.actor(), vehModifiedOn: new Date() },
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: exports.VEHICLE_TABLE_NAME,
                screenName: exports.VEHICLE_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: vehId,
                displayName: existing.vehVehicleNo,
                originalRecord: existing,
                modifiedRecord: saved,
                userId: this.actor(),
                notes: 'Vehicle soft deleted',
            }, tx);
            return { vehId, deleted: true, vehicleNo: existing.vehVehicleNo };
        });
    }
    async load(client, vehId) {
        const [r] = await client.$queryRaw `
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
};
exports.VehicleService = VehicleService;
exports.VehicleService = VehicleService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        audit_log_service_1.AuditLogService])
], VehicleService);
function toVehiclePayload(r) {
    return {
        vehId: r.veh_id,
        companyId: r.veh_company_id,
        branchId: r.veh_branch_id,
        branchName: r.br_name,
        vehicleNo: r.veh_vehicle_no,
        type: r.veh_type,
        description: r.veh_description,
        capacityKg: r.veh_capacity_kg === null ? null : Number(new client_1.Prisma.Decimal(r.veh_capacity_kg).toFixed(3)),
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
//# sourceMappingURL=vehicle.service.js.map