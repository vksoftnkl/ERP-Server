import { TemplateDefinitionInput } from '../dto/template-definition.schema';
export declare const GST_INVOICE_A4_NAME = "GST Tax Invoice \u2014 A4";
export declare const buildGstInvoiceA4: () => TemplateDefinitionInput;
export declare const A4_INVOICE_COLUMNS: {
    x: number;
    key: string;
    label: string;
    widthMm: number;
    align: "left" | "center" | "right";
}[];
