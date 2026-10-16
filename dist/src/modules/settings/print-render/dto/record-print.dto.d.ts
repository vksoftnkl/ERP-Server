import { RecordableOutputMode } from '../print-render.constants';
import { RenderPreviewDto } from './render-preview.dto';
declare const RecordPrintDto_base: import("@nestjs/common").Type<Pick<RenderPreviewDto, "companyId" | "branchId" | "accYear" | "deviceId" | "docId" | "versionId" | "docIds">>;
export declare class RecordPrintDto extends RecordPrintDto_base {
    outputMode: RecordableOutputMode;
    pageCount?: number;
    byteCount?: number;
}
export {};
