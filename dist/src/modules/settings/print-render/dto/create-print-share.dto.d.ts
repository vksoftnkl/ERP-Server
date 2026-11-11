import { RenderPreviewDto } from './render-preview.dto';
declare const CreatePrintShareDto_base: import("@nestjs/common").Type<Pick<RenderPreviewDto, "deviceId" | "companyId" | "branchId" | "accYear" | "versionId">>;
export declare class CreatePrintShareDto extends CreatePrintShareDto_base {
    docId: string;
    filename?: string;
}
export {};
