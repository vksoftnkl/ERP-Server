import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ConfirmSettlementLineDto, IgnoreSettlementLineDto, ImportSettlementDto, ResolveSettlementLineDto, SaveSettlementFormatDto, SettlementFormatQueryDto, SettlementKeyDto, SettlementLineKeyDto, TestSettlementFormatDto, VoidSettlementDto, WriteOffTenderDto } from './dto/tender-settlement.dto';
import { TenderSettlementExceptionService } from './tender-settlement-exceptions.service';
import { TenderSettlementService, type UploadedStatement } from './tender-settlement.service';
import type { SettlementFormatPayload, SettlementFormatTestPayload, SettlementImportPayload, SettlementImportResultPayload, SettlementPostPayload, SettlementResolvePayload, SettlementSuccessResponse, WriteOffPayload } from './types/tender-settlement-api.types';
export declare class TenderSettlementController {
    private readonly settlement;
    private readonly exceptions;
    private readonly prisma;
    private readonly requestContext;
    constructor(settlement: TenderSettlementService, exceptions: TenderSettlementExceptionService, prisma: PrismaService, requestContext: RequestContextService);
    getFormat(query: SettlementFormatQueryDto): Promise<SettlementSuccessResponse<SettlementFormatPayload>>;
    saveFormat(dto: SaveSettlementFormatDto): Promise<SettlementSuccessResponse<SettlementFormatPayload>>;
    testFormat(dto: TestSettlementFormatDto, file?: UploadedStatement): Promise<SettlementSuccessResponse<SettlementFormatTestPayload>>;
    import(dto: ImportSettlementDto, file?: UploadedStatement): Promise<SettlementSuccessResponse<SettlementImportResultPayload>>;
    get(query: SettlementKeyDto): Promise<SettlementSuccessResponse<SettlementImportPayload>>;
    match(dto: SettlementKeyDto): Promise<SettlementSuccessResponse<SettlementImportPayload>>;
    confirm(dto: ConfirmSettlementLineDto): Promise<SettlementSuccessResponse<SettlementImportPayload>>;
    unlink(dto: SettlementLineKeyDto): Promise<SettlementSuccessResponse<SettlementImportPayload>>;
    ignore(dto: IgnoreSettlementLineDto): Promise<SettlementSuccessResponse<SettlementImportPayload>>;
    post(dto: SettlementKeyDto): Promise<SettlementSuccessResponse<SettlementPostPayload>>;
    void(dto: VoidSettlementDto): Promise<SettlementSuccessResponse<SettlementImportPayload>>;
    resolve(dto: ResolveSettlementLineDto): Promise<SettlementSuccessResponse<SettlementResolvePayload>>;
    writeOff(dto: WriteOffTenderDto): Promise<SettlementSuccessResponse<WriteOffPayload>>;
    private requireRight;
}
