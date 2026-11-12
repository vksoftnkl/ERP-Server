import { SaveTransporterDto } from './dto/save-transporter.dto';
import { TransporterRefDto } from './dto/transporter-ref.dto';
import { TransporterService } from './transporter.service';
export declare class TransporterController {
    private readonly service;
    constructor(service: TransporterService);
    save(dto: SaveTransporterDto): Promise<{
        success: boolean;
        message: string;
        data: import("./transporter.service").TransporterPayload;
    }>;
    get(q: TransporterRefDto): Promise<{
        success: boolean;
        message: string;
        data: import("./transporter.service").TransporterPayload;
    }>;
    remove(dto: TransporterRefDto): Promise<{
        success: boolean;
        message: string;
        data: {
            trnId: string;
            deleted: true;
        };
    }>;
}
