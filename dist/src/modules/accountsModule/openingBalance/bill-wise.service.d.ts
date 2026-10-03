import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { ListOpeningBillsQueryDto, SaveOpeningBillsDto } from './dto/save-opening-bill.dto';
import { type OpeningBillsPayload, type OpeningBillsSavePayload } from './types/opening-balance-api.types';
export declare class BillWiseService {
    private readonly prisma;
    private readonly requestContextService;
    constructor(prisma: PrismaService, requestContextService: RequestContextService);
    list(query: ListOpeningBillsQueryDto): Promise<OpeningBillsPayload>;
    save(dto: SaveOpeningBillsDto): Promise<OpeningBillsSavePayload>;
    private syncOpeningFromBills;
    private resolveOpening;
    private findOpening;
    private billScope;
    private assertBillsAreWritable;
    private insertBill;
    private deleteAbsentBills;
    private requireParty;
    private toPayload;
    private toBillRow;
    private toNullableDate;
    private requireAccYear;
}
