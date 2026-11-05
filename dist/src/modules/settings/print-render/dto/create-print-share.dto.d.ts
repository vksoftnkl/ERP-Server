import { RenderPreviewDto } from './render-preview.dto';
declare const CreatePrintShareDto_base: import("@nestjs/common").Type<Pick<RenderPreviewDto, "companyId" | "branchId" | "accYear" | "deviceId" | "versionId">>;
export declare class CreatePrintShareDto extends CreatePrintShareDto_base {
    docId: string;
    filename?: string;
}
export {};
