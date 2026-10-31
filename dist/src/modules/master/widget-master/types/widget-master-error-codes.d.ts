export declare const WIDGET_ERROR: {
    readonly SECTION_ID_INVALID: "WIDGET_SECTION_ID_INVALID";
    readonly FIELD_ID_INVALID: "WIDGET_FIELD_ID_INVALID";
    readonly SECTION_NOT_FOUND: "WIDGET_SECTION_NOT_FOUND";
    readonly FIELD_NOT_FOUND: "WIDGET_FIELD_NOT_FOUND";
};
export type WidgetErrorCode = (typeof WIDGET_ERROR)[keyof typeof WIDGET_ERROR];
