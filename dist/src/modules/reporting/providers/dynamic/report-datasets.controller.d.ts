import { ReportDataset } from '@prisma/client';
import { TemplatesSuccessResponse } from '../../templates/types/templates-api.types';
import { ReportDatasetsService } from './report-datasets.service';
import { CreateReportDatasetDto, PreviewReportDatasetDto, ProbeReportDatasetDto, UpdateReportDatasetDto } from './dto/report-dataset-request.dto';
declare class ListReportDatasetsQueryDto {
    includeInactive?: boolean;
}
export declare class ReportDatasetsController {
    private readonly datasets;
    constructor(datasets: ReportDatasetsService);
    list(query: ListReportDatasetsQueryDto): Promise<TemplatesSuccessResponse<ReportDataset[], {
        count: number;
    }>>;
    probe(dto: ProbeReportDatasetDto): Promise<TemplatesSuccessResponse<Awaited<ReturnType<ReportDatasetsService['probe']>>>>;
    findOne(id: string): Promise<TemplatesSuccessResponse<ReportDataset>>;
    usage(id: string): Promise<TemplatesSuccessResponse<Array<{
        pt_id: string;
        pt_name: string;
    }>>>;
    create(dto: CreateReportDatasetDto): Promise<TemplatesSuccessResponse<ReportDataset>>;
    update(id: string, dto: UpdateReportDatasetDto): Promise<TemplatesSuccessResponse<ReportDataset>>;
    preview(id: string, dto: PreviewReportDatasetDto): Promise<TemplatesSuccessResponse<Awaited<ReturnType<ReportDatasetsService['preview']>>>>;
    remove(id: string, force?: string): Promise<TemplatesSuccessResponse<{
        rdsId: string;
        rdsToken: string;
    }>>;
}
export {};
