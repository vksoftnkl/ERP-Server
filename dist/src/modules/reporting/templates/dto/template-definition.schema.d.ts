import { z } from 'zod';
export declare const SCHEMA_VERSION = 1;
export declare const LAYOUT_MODES: readonly ["GRAPHIC", "GRID"];
export declare const OUTPUT_MODES: readonly ["PDF", "ESCPOS", "ESCP_DOTMATRIX", "HTML"];
export declare const ORIENTATIONS: readonly ["PORTRAIT", "LANDSCAPE"];
export declare const BAND_TYPES: readonly ["REPORT_HEADER", "PAGE_HEADER", "GROUP_HEADER", "DETAIL", "GROUP_FOOTER", "SUMMARY", "PAGE_FOOTER", "REPORT_FOOTER", "NO_DATA"];
export declare const ELEMENT_KINDS: readonly ["TEXT", "FIELD", "LINE", "RECT", "IMAGE", "BARCODE", "QRCODE", "PAGEBREAK"];
export declare const PRINT_ON: readonly ["ALL_PAGES", "FIRST_PAGE", "LAST_PAGE", "NOT_FIRST_PAGE", "NOT_LAST_PAGE"];
export declare const H_ALIGN: readonly ["left", "center", "right"];
export declare const V_ALIGN: readonly ["top", "middle", "bottom"];
export declare const IMAGE_FIT: readonly ["CONTAIN", "COVER", "STRETCH"];
export declare const CARDINALITY: readonly ["one", "many"];
export declare const AGGREGATE_FUNCTIONS: readonly ["sum", "count", "avg", "min", "max"];
export declare const AGGREGATE_SCOPES: readonly ["GROUP", "PAGE", "REPORT"];
export declare const BARCODE_SYMBOLOGIES: readonly ["code128", "ean13", "ean8", "upca", "code39", "itf14"];
export type BarcodeSymbology = (typeof BARCODE_SYMBOLOGIES)[number];
export declare const marginsSchema: z.ZodObject<{
    top: z.ZodNumber;
    right: z.ZodNumber;
    bottom: z.ZodNumber;
    left: z.ZodNumber;
}, z.core.$strip>;
export declare const paperSchema: z.ZodObject<{
    code: z.ZodString;
    widthMm: z.ZodNumber;
    heightMm: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    orientation: z.ZodDefault<z.ZodEnum<{
        PORTRAIT: "PORTRAIT";
        LANDSCAPE: "LANDSCAPE";
    }>>;
    margins: z.ZodObject<{
        top: z.ZodNumber;
        right: z.ZodNumber;
        bottom: z.ZodNumber;
        left: z.ZodNumber;
    }, z.core.$strip>;
    columns: z.ZodOptional<z.ZodNumber>;
    rows: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const datasetSchema: z.ZodObject<{
    name: z.ZodString;
    provider: z.ZodString;
    cardinality: z.ZodEnum<{
        one: "one";
        many: "many";
    }>;
    params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export declare const fontSchema: z.ZodObject<{
    family: z.ZodDefault<z.ZodString>;
    size: z.ZodDefault<z.ZodNumber>;
    bold: z.ZodDefault<z.ZodBoolean>;
    italic: z.ZodDefault<z.ZodBoolean>;
    underline: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const styleSchema: z.ZodObject<{
    color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
    strokeWidthPt: z.ZodOptional<z.ZodNumber>;
    padding: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const textElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    value: z.ZodString;
    font: z.ZodOptional<z.ZodObject<{
        family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, z.core.$strip>>;
    align: z.ZodDefault<z.ZodEnum<{
        left: "left";
        center: "center";
        right: "right";
    }>>;
    vAlign: z.ZodDefault<z.ZodEnum<{
        top: "top";
        middle: "middle";
        bottom: "bottom";
    }>>;
    wrap: z.ZodDefault<z.ZodBoolean>;
    ellipsis: z.ZodDefault<z.ZodBoolean>;
    blankWhenZero: z.ZodDefault<z.ZodBoolean>;
    kind: z.ZodLiteral<"TEXT">;
}, z.core.$strip>;
export declare const fieldElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    value: z.ZodString;
    font: z.ZodOptional<z.ZodObject<{
        family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, z.core.$strip>>;
    align: z.ZodDefault<z.ZodEnum<{
        left: "left";
        center: "center";
        right: "right";
    }>>;
    vAlign: z.ZodDefault<z.ZodEnum<{
        top: "top";
        middle: "middle";
        bottom: "bottom";
    }>>;
    wrap: z.ZodDefault<z.ZodBoolean>;
    ellipsis: z.ZodDefault<z.ZodBoolean>;
    blankWhenZero: z.ZodDefault<z.ZodBoolean>;
    kind: z.ZodLiteral<"FIELD">;
    aggregate: z.ZodOptional<z.ZodObject<{
        fn: z.ZodEnum<{
            count: "count";
            max: "max";
            min: "min";
            sum: "sum";
            avg: "avg";
        }>;
        scope: z.ZodEnum<{
            GROUP: "GROUP";
            PAGE: "PAGE";
            REPORT: "REPORT";
        }>;
        dataset: z.ZodOptional<z.ZodString>;
        over: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const lineElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"LINE">;
    x1: z.ZodNumber;
    y1: z.ZodNumber;
    x2: z.ZodNumber;
    y2: z.ZodNumber;
    widthPt: z.ZodDefault<z.ZodNumber>;
    gridChar: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
export declare const rectElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"RECT">;
    w: z.ZodNumber;
    h: z.ZodNumber;
    radiusMm: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
export declare const imageElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"IMAGE">;
    w: z.ZodNumber;
    h: z.ZodNumber;
    source: z.ZodString;
    fit: z.ZodDefault<z.ZodEnum<{
        CONTAIN: "CONTAIN";
        COVER: "COVER";
        STRETCH: "STRETCH";
    }>>;
}, z.core.$strip>;
export declare const barcodeElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"BARCODE">;
    w: z.ZodNumber;
    h: z.ZodNumber;
    symbology: z.ZodDefault<z.ZodEnum<{
        code128: "code128";
        ean13: "ean13";
        ean8: "ean8";
        upca: "upca";
        code39: "code39";
        itf14: "itf14";
    }>>;
    value: z.ZodString;
    showText: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export declare const qrcodeElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"QRCODE">;
    size: z.ZodNumber;
    value: z.ZodString;
    errorCorrection: z.ZodDefault<z.ZodEnum<{
        L: "L";
        M: "M";
        Q: "Q";
        H: "H";
    }>>;
}, z.core.$strip>;
export declare const pagebreakElementSchema: z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"PAGEBREAK">;
    when: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const elementSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    value: z.ZodString;
    font: z.ZodOptional<z.ZodObject<{
        family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, z.core.$strip>>;
    align: z.ZodDefault<z.ZodEnum<{
        left: "left";
        center: "center";
        right: "right";
    }>>;
    vAlign: z.ZodDefault<z.ZodEnum<{
        top: "top";
        middle: "middle";
        bottom: "bottom";
    }>>;
    wrap: z.ZodDefault<z.ZodBoolean>;
    ellipsis: z.ZodDefault<z.ZodBoolean>;
    blankWhenZero: z.ZodDefault<z.ZodBoolean>;
    kind: z.ZodLiteral<"TEXT">;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    value: z.ZodString;
    font: z.ZodOptional<z.ZodObject<{
        family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
        size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
        bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, z.core.$strip>>;
    align: z.ZodDefault<z.ZodEnum<{
        left: "left";
        center: "center";
        right: "right";
    }>>;
    vAlign: z.ZodDefault<z.ZodEnum<{
        top: "top";
        middle: "middle";
        bottom: "bottom";
    }>>;
    wrap: z.ZodDefault<z.ZodBoolean>;
    ellipsis: z.ZodDefault<z.ZodBoolean>;
    blankWhenZero: z.ZodDefault<z.ZodBoolean>;
    kind: z.ZodLiteral<"FIELD">;
    aggregate: z.ZodOptional<z.ZodObject<{
        fn: z.ZodEnum<{
            count: "count";
            max: "max";
            min: "min";
            sum: "sum";
            avg: "avg";
        }>;
        scope: z.ZodEnum<{
            GROUP: "GROUP";
            PAGE: "PAGE";
            REPORT: "REPORT";
        }>;
        dataset: z.ZodOptional<z.ZodString>;
        over: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"LINE">;
    x1: z.ZodNumber;
    y1: z.ZodNumber;
    x2: z.ZodNumber;
    y2: z.ZodNumber;
    widthPt: z.ZodDefault<z.ZodNumber>;
    gridChar: z.ZodDefault<z.ZodString>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"RECT">;
    w: z.ZodNumber;
    h: z.ZodNumber;
    radiusMm: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"IMAGE">;
    w: z.ZodNumber;
    h: z.ZodNumber;
    source: z.ZodString;
    fit: z.ZodDefault<z.ZodEnum<{
        CONTAIN: "CONTAIN";
        COVER: "COVER";
        STRETCH: "STRETCH";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"BARCODE">;
    w: z.ZodNumber;
    h: z.ZodNumber;
    symbology: z.ZodDefault<z.ZodEnum<{
        code128: "code128";
        ean13: "ean13";
        ean8: "ean8";
        upca: "upca";
        code39: "code39";
        itf14: "itf14";
    }>>;
    value: z.ZodString;
    showText: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"QRCODE">;
    size: z.ZodNumber;
    value: z.ZodString;
    errorCorrection: z.ZodDefault<z.ZodEnum<{
        L: "L";
        M: "M";
        Q: "Q";
        H: "H";
    }>>;
}, z.core.$strip>, z.ZodObject<{
    id: z.ZodString;
    x: z.ZodDefault<z.ZodNumber>;
    y: z.ZodDefault<z.ZodNumber>;
    w: z.ZodOptional<z.ZodNumber>;
    h: z.ZodOptional<z.ZodNumber>;
    col: z.ZodOptional<z.ZodNumber>;
    row: z.ZodOptional<z.ZodNumber>;
    cols: z.ZodOptional<z.ZodNumber>;
    visible: z.ZodOptional<z.ZodString>;
    style: z.ZodOptional<z.ZodObject<{
        color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
        strokeWidthPt: z.ZodOptional<z.ZodNumber>;
        padding: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    z: z.ZodDefault<z.ZodNumber>;
    kind: z.ZodLiteral<"PAGEBREAK">;
    when: z.ZodOptional<z.ZodString>;
}, z.core.$strip>], "kind">;
export declare const bandSchema: z.ZodObject<{
    type: z.ZodEnum<{
        REPORT_HEADER: "REPORT_HEADER";
        PAGE_HEADER: "PAGE_HEADER";
        GROUP_HEADER: "GROUP_HEADER";
        DETAIL: "DETAIL";
        GROUP_FOOTER: "GROUP_FOOTER";
        SUMMARY: "SUMMARY";
        PAGE_FOOTER: "PAGE_FOOTER";
        REPORT_FOOTER: "REPORT_FOOTER";
        NO_DATA: "NO_DATA";
    }>;
    heightMm: z.ZodDefault<z.ZodNumber>;
    heightRows: z.ZodOptional<z.ZodNumber>;
    dataset: z.ZodOptional<z.ZodString>;
    groupBy: z.ZodOptional<z.ZodString>;
    groupLevel: z.ZodDefault<z.ZodNumber>;
    printOn: z.ZodDefault<z.ZodEnum<{
        ALL_PAGES: "ALL_PAGES";
        FIRST_PAGE: "FIRST_PAGE";
        LAST_PAGE: "LAST_PAGE";
        NOT_FIRST_PAGE: "NOT_FIRST_PAGE";
        NOT_LAST_PAGE: "NOT_LAST_PAGE";
    }>>;
    autoGrow: z.ZodDefault<z.ZodBoolean>;
    keepTogether: z.ZodDefault<z.ZodBoolean>;
    keepWithNext: z.ZodDefault<z.ZodBoolean>;
    keepWithLastDetail: z.ZodDefault<z.ZodBoolean>;
    visible: z.ZodOptional<z.ZodString>;
    spacingRows: z.ZodDefault<z.ZodNumber>;
    elements: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        w: z.ZodOptional<z.ZodNumber>;
        h: z.ZodOptional<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        value: z.ZodString;
        font: z.ZodOptional<z.ZodObject<{
            family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
            size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        }, z.core.$strip>>;
        align: z.ZodDefault<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>;
        vAlign: z.ZodDefault<z.ZodEnum<{
            top: "top";
            middle: "middle";
            bottom: "bottom";
        }>>;
        wrap: z.ZodDefault<z.ZodBoolean>;
        ellipsis: z.ZodDefault<z.ZodBoolean>;
        blankWhenZero: z.ZodDefault<z.ZodBoolean>;
        kind: z.ZodLiteral<"TEXT">;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        w: z.ZodOptional<z.ZodNumber>;
        h: z.ZodOptional<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        value: z.ZodString;
        font: z.ZodOptional<z.ZodObject<{
            family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
            size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
            bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        }, z.core.$strip>>;
        align: z.ZodDefault<z.ZodEnum<{
            left: "left";
            center: "center";
            right: "right";
        }>>;
        vAlign: z.ZodDefault<z.ZodEnum<{
            top: "top";
            middle: "middle";
            bottom: "bottom";
        }>>;
        wrap: z.ZodDefault<z.ZodBoolean>;
        ellipsis: z.ZodDefault<z.ZodBoolean>;
        blankWhenZero: z.ZodDefault<z.ZodBoolean>;
        kind: z.ZodLiteral<"FIELD">;
        aggregate: z.ZodOptional<z.ZodObject<{
            fn: z.ZodEnum<{
                count: "count";
                max: "max";
                min: "min";
                sum: "sum";
                avg: "avg";
            }>;
            scope: z.ZodEnum<{
                GROUP: "GROUP";
                PAGE: "PAGE";
                REPORT: "REPORT";
            }>;
            dataset: z.ZodOptional<z.ZodString>;
            over: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        w: z.ZodOptional<z.ZodNumber>;
        h: z.ZodOptional<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        kind: z.ZodLiteral<"LINE">;
        x1: z.ZodNumber;
        y1: z.ZodNumber;
        x2: z.ZodNumber;
        y2: z.ZodNumber;
        widthPt: z.ZodDefault<z.ZodNumber>;
        gridChar: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        kind: z.ZodLiteral<"RECT">;
        w: z.ZodNumber;
        h: z.ZodNumber;
        radiusMm: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        kind: z.ZodLiteral<"IMAGE">;
        w: z.ZodNumber;
        h: z.ZodNumber;
        source: z.ZodString;
        fit: z.ZodDefault<z.ZodEnum<{
            CONTAIN: "CONTAIN";
            COVER: "COVER";
            STRETCH: "STRETCH";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        kind: z.ZodLiteral<"BARCODE">;
        w: z.ZodNumber;
        h: z.ZodNumber;
        symbology: z.ZodDefault<z.ZodEnum<{
            code128: "code128";
            ean13: "ean13";
            ean8: "ean8";
            upca: "upca";
            code39: "code39";
            itf14: "itf14";
        }>>;
        value: z.ZodString;
        showText: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        w: z.ZodOptional<z.ZodNumber>;
        h: z.ZodOptional<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        kind: z.ZodLiteral<"QRCODE">;
        size: z.ZodNumber;
        value: z.ZodString;
        errorCorrection: z.ZodDefault<z.ZodEnum<{
            L: "L";
            M: "M";
            Q: "Q";
            H: "H";
        }>>;
    }, z.core.$strip>, z.ZodObject<{
        id: z.ZodString;
        x: z.ZodDefault<z.ZodNumber>;
        y: z.ZodDefault<z.ZodNumber>;
        w: z.ZodOptional<z.ZodNumber>;
        h: z.ZodOptional<z.ZodNumber>;
        col: z.ZodOptional<z.ZodNumber>;
        row: z.ZodOptional<z.ZodNumber>;
        cols: z.ZodOptional<z.ZodNumber>;
        visible: z.ZodOptional<z.ZodString>;
        style: z.ZodOptional<z.ZodObject<{
            color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
            strokeWidthPt: z.ZodOptional<z.ZodNumber>;
            padding: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
        z: z.ZodDefault<z.ZodNumber>;
        kind: z.ZodLiteral<"PAGEBREAK">;
        when: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>], "kind">>>;
}, z.core.$strip>;
export declare const templateDefinitionSchema: z.ZodObject<{
    schemaVersion: z.ZodNumber;
    layoutMode: z.ZodEnum<{
        GRAPHIC: "GRAPHIC";
        GRID: "GRID";
    }>;
    meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    paper: z.ZodObject<{
        code: z.ZodString;
        widthMm: z.ZodNumber;
        heightMm: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
        orientation: z.ZodDefault<z.ZodEnum<{
            PORTRAIT: "PORTRAIT";
            LANDSCAPE: "LANDSCAPE";
        }>>;
        margins: z.ZodObject<{
            top: z.ZodNumber;
            right: z.ZodNumber;
            bottom: z.ZodNumber;
            left: z.ZodNumber;
        }, z.core.$strip>;
        columns: z.ZodOptional<z.ZodNumber>;
        rows: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>;
    datasets: z.ZodDefault<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        provider: z.ZodString;
        cardinality: z.ZodEnum<{
            one: "one";
            many: "many";
        }>;
        params: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>>>;
    bands: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            REPORT_HEADER: "REPORT_HEADER";
            PAGE_HEADER: "PAGE_HEADER";
            GROUP_HEADER: "GROUP_HEADER";
            DETAIL: "DETAIL";
            GROUP_FOOTER: "GROUP_FOOTER";
            SUMMARY: "SUMMARY";
            PAGE_FOOTER: "PAGE_FOOTER";
            REPORT_FOOTER: "REPORT_FOOTER";
            NO_DATA: "NO_DATA";
        }>;
        heightMm: z.ZodDefault<z.ZodNumber>;
        heightRows: z.ZodOptional<z.ZodNumber>;
        dataset: z.ZodOptional<z.ZodString>;
        groupBy: z.ZodOptional<z.ZodString>;
        groupLevel: z.ZodDefault<z.ZodNumber>;
        printOn: z.ZodDefault<z.ZodEnum<{
            ALL_PAGES: "ALL_PAGES";
            FIRST_PAGE: "FIRST_PAGE";
            LAST_PAGE: "LAST_PAGE";
            NOT_FIRST_PAGE: "NOT_FIRST_PAGE";
            NOT_LAST_PAGE: "NOT_LAST_PAGE";
        }>>;
        autoGrow: z.ZodDefault<z.ZodBoolean>;
        keepTogether: z.ZodDefault<z.ZodBoolean>;
        keepWithNext: z.ZodDefault<z.ZodBoolean>;
        keepWithLastDetail: z.ZodDefault<z.ZodBoolean>;
        visible: z.ZodOptional<z.ZodString>;
        spacingRows: z.ZodDefault<z.ZodNumber>;
        elements: z.ZodDefault<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            w: z.ZodOptional<z.ZodNumber>;
            h: z.ZodOptional<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            value: z.ZodString;
            font: z.ZodOptional<z.ZodObject<{
                family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
                size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
                bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
                italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
                underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            }, z.core.$strip>>;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
            vAlign: z.ZodDefault<z.ZodEnum<{
                top: "top";
                middle: "middle";
                bottom: "bottom";
            }>>;
            wrap: z.ZodDefault<z.ZodBoolean>;
            ellipsis: z.ZodDefault<z.ZodBoolean>;
            blankWhenZero: z.ZodDefault<z.ZodBoolean>;
            kind: z.ZodLiteral<"TEXT">;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            w: z.ZodOptional<z.ZodNumber>;
            h: z.ZodOptional<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            value: z.ZodString;
            font: z.ZodOptional<z.ZodObject<{
                family: z.ZodOptional<z.ZodDefault<z.ZodString>>;
                size: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
                bold: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
                italic: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
                underline: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
            }, z.core.$strip>>;
            align: z.ZodDefault<z.ZodEnum<{
                left: "left";
                center: "center";
                right: "right";
            }>>;
            vAlign: z.ZodDefault<z.ZodEnum<{
                top: "top";
                middle: "middle";
                bottom: "bottom";
            }>>;
            wrap: z.ZodDefault<z.ZodBoolean>;
            ellipsis: z.ZodDefault<z.ZodBoolean>;
            blankWhenZero: z.ZodDefault<z.ZodBoolean>;
            kind: z.ZodLiteral<"FIELD">;
            aggregate: z.ZodOptional<z.ZodObject<{
                fn: z.ZodEnum<{
                    count: "count";
                    max: "max";
                    min: "min";
                    sum: "sum";
                    avg: "avg";
                }>;
                scope: z.ZodEnum<{
                    GROUP: "GROUP";
                    PAGE: "PAGE";
                    REPORT: "REPORT";
                }>;
                dataset: z.ZodOptional<z.ZodString>;
                over: z.ZodOptional<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            w: z.ZodOptional<z.ZodNumber>;
            h: z.ZodOptional<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            kind: z.ZodLiteral<"LINE">;
            x1: z.ZodNumber;
            y1: z.ZodNumber;
            x2: z.ZodNumber;
            y2: z.ZodNumber;
            widthPt: z.ZodDefault<z.ZodNumber>;
            gridChar: z.ZodDefault<z.ZodString>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            kind: z.ZodLiteral<"RECT">;
            w: z.ZodNumber;
            h: z.ZodNumber;
            radiusMm: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            kind: z.ZodLiteral<"IMAGE">;
            w: z.ZodNumber;
            h: z.ZodNumber;
            source: z.ZodString;
            fit: z.ZodDefault<z.ZodEnum<{
                CONTAIN: "CONTAIN";
                COVER: "COVER";
                STRETCH: "STRETCH";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            kind: z.ZodLiteral<"BARCODE">;
            w: z.ZodNumber;
            h: z.ZodNumber;
            symbology: z.ZodDefault<z.ZodEnum<{
                code128: "code128";
                ean13: "ean13";
                ean8: "ean8";
                upca: "upca";
                code39: "code39";
                itf14: "itf14";
            }>>;
            value: z.ZodString;
            showText: z.ZodDefault<z.ZodBoolean>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            w: z.ZodOptional<z.ZodNumber>;
            h: z.ZodOptional<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            kind: z.ZodLiteral<"QRCODE">;
            size: z.ZodNumber;
            value: z.ZodString;
            errorCorrection: z.ZodDefault<z.ZodEnum<{
                L: "L";
                M: "M";
                Q: "Q";
                H: "H";
            }>>;
        }, z.core.$strip>, z.ZodObject<{
            id: z.ZodString;
            x: z.ZodDefault<z.ZodNumber>;
            y: z.ZodDefault<z.ZodNumber>;
            w: z.ZodOptional<z.ZodNumber>;
            h: z.ZodOptional<z.ZodNumber>;
            col: z.ZodOptional<z.ZodNumber>;
            row: z.ZodOptional<z.ZodNumber>;
            cols: z.ZodOptional<z.ZodNumber>;
            visible: z.ZodOptional<z.ZodString>;
            style: z.ZodOptional<z.ZodObject<{
                color: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                fill: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                stroke: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodString]>>;
                strokeWidthPt: z.ZodOptional<z.ZodNumber>;
                padding: z.ZodOptional<z.ZodNumber>;
            }, z.core.$strip>>;
            z: z.ZodDefault<z.ZodNumber>;
            kind: z.ZodLiteral<"PAGEBREAK">;
            when: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>], "kind">>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;
export type TemplateDefinitionInput = z.input<typeof templateDefinitionSchema>;
export type Band = z.infer<typeof bandSchema>;
export type BandType = (typeof BAND_TYPES)[number];
export type ReportElement = z.infer<typeof elementSchema>;
export type ElementKind = (typeof ELEMENT_KINDS)[number];
export type PaperSpec = z.infer<typeof paperSchema>;
export type Margins = z.infer<typeof marginsSchema>;
export type DatasetBinding = z.infer<typeof datasetSchema>;
export type FontSpec = z.infer<typeof fontSchema>;
export type StyleSpec = z.infer<typeof styleSchema>;
export type LayoutMode = (typeof LAYOUT_MODES)[number];
export type OutputMode = (typeof OUTPUT_MODES)[number];
export type HorizontalAlign = (typeof H_ALIGN)[number];
export type VerticalAlign = (typeof V_ALIGN)[number];
export type AggregateFunction = (typeof AGGREGATE_FUNCTIONS)[number];
export type AggregateScope = (typeof AGGREGATE_SCOPES)[number];
export type TextLikeElement = z.infer<typeof textElementSchema> | z.infer<typeof fieldElementSchema>;
export declare const isTextLike: (element: ReportElement) => element is TextLikeElement;
