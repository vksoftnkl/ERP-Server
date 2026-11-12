import { SaveVehicleDto } from './dto/save-vehicle.dto';
import { VehicleRefDto } from './dto/vehicle-ref.dto';
import { VehicleService } from './vehicle.service';
export declare class VehicleController {
    private readonly service;
    constructor(service: VehicleService);
    save(dto: SaveVehicleDto): Promise<{
        success: boolean;
        message: string;
        data: import("./vehicle.service").VehiclePayload;
    }>;
    get(q: VehicleRefDto): Promise<{
        success: boolean;
        message: string;
        data: import("./vehicle.service").VehiclePayload;
    }>;
    remove(dto: VehicleRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            vehId: string;
            deleted: true;
        };
    }>;
}
