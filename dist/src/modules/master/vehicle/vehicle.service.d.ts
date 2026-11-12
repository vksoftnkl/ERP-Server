import { Prisma } from '@prisma/client';
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { SaveVehicleDto } from './dto/save-vehicle.dto';
export declare const VEHICLE_MENU_ID = 125;
export declare const VEHICLE_AUDIT_SCREEN_NAME = "Vehicle Master";
export declare const VEHICLE_TABLE_NAME = "public.vehicle_master";
export declare function cleanVehicleNo(raw: string | null | undefined): string;
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
export declare class VehicleService {
    private readonly prisma;
    private readonly ctx;
    private readonly auditLogService;
    constructor(prisma: PrismaService, ctx: RequestContextService, auditLogService: AuditLogService);
    private actor;
    private assertRight;
    private loginCompany;
    private resolveCompany;
    private refuse;
    private notFound;
    private loadLive;
    save(dto: SaveVehicleDto): Promise<VehiclePayload>;
    getById(vehId: string): Promise<VehiclePayload>;
    softDelete(vehId: string): Promise<{
        vehId: string;
        deleted: true;
        vehicleNo: string;
    }>;
    private load;
}
export declare function toVehiclePayload(r: VehicleRow): VehiclePayload;
export {};
