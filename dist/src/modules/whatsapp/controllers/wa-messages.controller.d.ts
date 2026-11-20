import { WaRetryDto, WaSendDto } from '../dto/wa.dto';
import { WaMessagesService } from '../wa-messages.service';
export declare class WaMessagesController {
    private readonly messages;
    constructor(messages: WaMessagesService);
    send(dto: WaSendDto): Promise<{
        success: true;
        message: string;
        data: import("../wa-send.service").WaSendOutcome;
    }>;
    retry(dto: WaRetryDto): Promise<{
        success: true;
        message: string;
        data: import("../wa-send.service").WaSendOutcome;
    }>;
}
