import { PrismaService } from '../../../database/prisma/prisma.service';
import { PrinterCommandProfile } from '../engine/renderers/renderer.types';
export declare class PrinterProfileService {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    findByCode(code: string, companyId: string | null): Promise<PrinterCommandProfile>;
    findDefault(outputMode: string, companyId: string | null): Promise<PrinterCommandProfile | null>;
    list(companyId: string | null, outputMode?: string): Promise<PrinterCommandProfile[]>;
}
