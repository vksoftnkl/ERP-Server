import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import type { GodownPositionBehindDto, GodownPositionExportDto, GodownPositionQueryDto } from './dto/godown-position-query.dto';
import { type BehindPayload, type PositionExportPayload, type PositionPayload } from './types/godown-position.types';
export declare class GodownPositionService {
    private readonly prisma;
    private readonly requestContext;
    constructor(prisma: PrismaService, requestContext: RequestContextService);
    show(q: GodownPositionQueryDto): Promise<PositionPayload>;
    export(q: GodownPositionExportDto): Promise<PositionExportPayload>;
    printData(q: GodownPositionQueryDto, userId: string | null): Promise<PositionExportPayload>;
    private exportPayload;
    behind(q: GodownPositionBehindDto): Promise<BehindPayload>;
    private build;
    private scopeOf;
    private assertRight;
    private assertAlso;
    private snapshot;
    private moment;
    private lookup;
}
