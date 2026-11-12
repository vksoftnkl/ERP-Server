export declare const VEHICLE_TYPES: readonly ["REGULAR", "ODC"];
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export declare class SaveVehicleDto {
    vehId?: string;
    companyId: string;
    branchId?: string | null;
    vehicleNo: string;
    type: VehicleType;
    description?: string | null;
    capacityKg?: number | null;
    isOwn?: boolean;
    transporterId?: string | null;
    driverId?: string | null;
    isActive?: boolean;
}
