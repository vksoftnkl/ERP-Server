import { OutputMode, TemplateDefinitionInput } from '../dto/template-definition.schema';
export interface GalleryTemplate {
    readonly key: string;
    readonly name: string;
    readonly docType: string;
    readonly outputMode: OutputMode;
    readonly paperCode: string;
    readonly isDefault: boolean;
    readonly build: () => TemplateDefinitionInput;
}
export declare const GALLERY_TEMPLATES: readonly GalleryTemplate[];
export declare const findGalleryTemplate: (key: string) => GalleryTemplate | undefined;
