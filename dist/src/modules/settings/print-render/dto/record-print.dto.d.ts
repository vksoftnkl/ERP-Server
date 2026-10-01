import { RecordableOutputMode } from '../print-render.constants';
import { RenderPreviewDto } from './render-preview.dto';
declare const RecordPrintDto_base: import("@nestjs/common").Type<Pick<RenderPreviewDto, "versionId" | "docId" | "docIds" | "companyId" | "accYear" | "branchId" | "deviceId">>;
export declare class RecordPrintDto extends RecordPrintDto_base {
    outputMode: RecordableOutputMode;
    pageCount?: number;
    byteCount?: number;
}
export {};
