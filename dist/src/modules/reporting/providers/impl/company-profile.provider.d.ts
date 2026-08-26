import { PrismaService } from '../../../../database/prisma/prisma.service';
import { FieldMeta, IReportDataProvider, ReportContext, ReportRow } from '../report-data-provider.types';
export declare class CompanyProfileProvider implements IReportDataProvider {
    private readonly prisma;
    constructor(prisma: PrismaService);
    fields(): readonly FieldMeta[];
    resolve(context: ReportContext): Promise<ReportRow>;
    sampleData(): ReportRow;
    private emptyRow;
}
