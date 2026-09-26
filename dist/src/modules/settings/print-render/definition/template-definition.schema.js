"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTextLike = exports.templateDefinitionSchema = exports.bandSchema = exports.elementSchema = exports.crosstabElementSchema = exports.crosstabMeasureSchema = exports.crosstabAxisSchema = exports.pagebreakElementSchema = exports.qrcodeElementSchema = exports.barcodeElementSchema = exports.imageElementSchema = exports.rectElementSchema = exports.lineElementSchema = exports.fieldElementSchema = exports.textElementSchema = exports.styleSchema = exports.fontSchema = exports.datasetSchema = exports.paperSchema = exports.marginsSchema = exports.CROSSTAB_BANDS = exports.CROSSTAB_OVERFLOWS = exports.CROSSTAB_SORTS = exports.BARCODE_SYMBOLOGIES = exports.AGGREGATE_SCOPES = exports.AGGREGATE_FUNCTIONS = exports.CARDINALITY = exports.IMAGE_FIT = exports.V_ALIGN = exports.H_ALIGN = exports.PRINT_ON = exports.ELEMENT_KINDS = exports.BAND_TYPES = exports.ORIENTATIONS = exports.OUTPUT_MODES = exports.LAYOUT_MODES = exports.SCHEMA_VERSION = void 0;
const zod_1 = require("zod");
exports.SCHEMA_VERSION = 1;
exports.LAYOUT_MODES = ['GRAPHIC', 'GRID'];
exports.OUTPUT_MODES = ['PDF', 'ESCPOS', 'ESCP_DOTMATRIX', 'HTML'];
exports.ORIENTATIONS = ['PORTRAIT', 'LANDSCAPE'];
exports.BAND_TYPES = [
    'REPORT_HEADER',
    'PAGE_HEADER',
    'GROUP_HEADER',
    'DETAIL',
    'GROUP_FOOTER',
    'SUMMARY',
    'PAGE_FOOTER',
    'REPORT_FOOTER',
    'NO_DATA',
];
exports.ELEMENT_KINDS = [
    'TEXT',
    'FIELD',
    'LINE',
    'RECT',
    'IMAGE',
    'BARCODE',
    'QRCODE',
    'PAGEBREAK',
    'CROSSTAB',
];
exports.PRINT_ON = [
    'ALL_PAGES',
    'FIRST_PAGE',
    'LAST_PAGE',
    'NOT_FIRST_PAGE',
    'NOT_LAST_PAGE',
];
exports.H_ALIGN = ['left', 'center', 'right'];
exports.V_ALIGN = ['top', 'middle', 'bottom'];
exports.IMAGE_FIT = ['CONTAIN', 'COVER', 'STRETCH'];
exports.CARDINALITY = ['one', 'many'];
exports.AGGREGATE_FUNCTIONS = ['sum', 'count', 'avg', 'min', 'max'];
exports.AGGREGATE_SCOPES = ['GROUP', 'PAGE', 'REPORT'];
exports.BARCODE_SYMBOLOGIES = ['code128', 'ean13', 'ean8', 'upca', 'code39', 'itf14'];
exports.CROSSTAB_SORTS = [
    'LABEL_ASC',
    'LABEL_DESC',
    'VALUE_DESC',
    'VALUE_ASC',
    'FIRST_SEEN',
];
exports.CROSSTAB_OVERFLOWS = ['FOLD', 'CLIP'];
exports.CROSSTAB_BANDS = [
    'REPORT_HEADER',
    'SUMMARY',
    'REPORT_FOOTER',
    'NO_DATA',
];
const millimetres = zod_1.z.number().finite().min(-10_000).max(10_000);
const millimetreSize = zod_1.z.number().finite().min(0).max(10_000);
const cellIndex = zod_1.z.number().int().min(0).max(2_000);
const expressionString = zod_1.z.string().max(4_000);
const hexColour = zod_1.z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'colour must be #rrggbb')
    .or(expressionString.refine((value) => value.includes('{{'), 'colour must be #rrggbb or an expression'));
const identifier = zod_1.z
    .string()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'must be a valid identifier');
exports.marginsSchema = zod_1.z.object({
    top: millimetreSize,
    right: millimetreSize,
    bottom: millimetreSize,
    left: millimetreSize,
});
exports.paperSchema = zod_1.z.object({
    code: zod_1.z.string().min(1).max(20),
    widthMm: millimetreSize.positive(),
    heightMm: millimetreSize.positive().nullable().default(null),
    orientation: zod_1.z.enum(exports.ORIENTATIONS).default('PORTRAIT'),
    margins: exports.marginsSchema,
    columns: zod_1.z.number().int().min(1).max(2_000).optional(),
    rows: zod_1.z.number().int().min(1).max(2_000).optional(),
});
exports.datasetSchema = zod_1.z.object({
    name: identifier,
    provider: zod_1.z.string().min(1).max(120),
    cardinality: zod_1.z.enum(exports.CARDINALITY),
    params: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.fontSchema = zod_1.z.object({
    family: zod_1.z.string().min(1).max(60).default('NotoSans'),
    size: zod_1.z.number().min(1).max(200).default(9),
    bold: zod_1.z.boolean().default(false),
    italic: zod_1.z.boolean().default(false),
    underline: zod_1.z.boolean().default(false),
});
exports.styleSchema = zod_1.z.object({
    color: hexColour.optional(),
    fill: hexColour.optional(),
    stroke: hexColour.optional(),
    strokeWidthPt: zod_1.z.number().min(0).max(20).optional(),
    padding: zod_1.z.number().min(0).max(50).optional(),
});
const elementBase = zod_1.z.object({
    id: zod_1.z.string().min(1).max(60),
    x: millimetres.default(0),
    y: millimetres.default(0),
    w: millimetreSize.optional(),
    h: millimetreSize.optional(),
    col: cellIndex.optional(),
    row: cellIndex.optional(),
    cols: zod_1.z.number().int().min(1).max(2_000).optional(),
    visible: expressionString.optional(),
    style: exports.styleSchema.optional(),
    z: zod_1.z.number().int().min(0).max(1_000).default(0),
});
const textLikeElement = elementBase.extend({
    value: expressionString,
    font: exports.fontSchema.partial().optional(),
    align: zod_1.z.enum(exports.H_ALIGN).default('left'),
    vAlign: zod_1.z.enum(exports.V_ALIGN).default('top'),
    wrap: zod_1.z.boolean().default(false),
    ellipsis: zod_1.z.boolean().default(false),
    blankWhenZero: zod_1.z.boolean().default(false),
});
exports.textElementSchema = textLikeElement.extend({ kind: zod_1.z.literal('TEXT') });
exports.fieldElementSchema = textLikeElement.extend({
    kind: zod_1.z.literal('FIELD'),
    aggregate: zod_1.z
        .object({
        fn: zod_1.z.enum(exports.AGGREGATE_FUNCTIONS),
        scope: zod_1.z.enum(exports.AGGREGATE_SCOPES),
        dataset: identifier.optional(),
        over: expressionString.optional(),
    })
        .optional(),
});
exports.lineElementSchema = elementBase.extend({
    kind: zod_1.z.literal('LINE'),
    x1: millimetres,
    y1: millimetres,
    x2: millimetres,
    y2: millimetres,
    widthPt: zod_1.z.number().min(0).max(20).default(0.5),
    gridChar: zod_1.z.string().length(1).default('-'),
});
exports.rectElementSchema = elementBase.extend({
    kind: zod_1.z.literal('RECT'),
    w: millimetreSize,
    h: millimetreSize,
    radiusMm: zod_1.z.number().min(0).max(50).default(0),
});
exports.imageElementSchema = elementBase.extend({
    kind: zod_1.z.literal('IMAGE'),
    w: millimetreSize,
    h: millimetreSize,
    source: expressionString,
    fit: zod_1.z.enum(exports.IMAGE_FIT).default('CONTAIN'),
});
exports.barcodeElementSchema = elementBase.extend({
    kind: zod_1.z.literal('BARCODE'),
    w: millimetreSize,
    h: millimetreSize,
    symbology: zod_1.z.enum(exports.BARCODE_SYMBOLOGIES).default('code128'),
    value: expressionString,
    showText: zod_1.z.boolean().default(false),
});
exports.qrcodeElementSchema = elementBase.extend({
    kind: zod_1.z.literal('QRCODE'),
    size: millimetreSize.positive(),
    value: expressionString,
    errorCorrection: zod_1.z.enum(['L', 'M', 'Q', 'H']).default('M'),
});
exports.pagebreakElementSchema = elementBase.extend({
    kind: zod_1.z.literal('PAGEBREAK'),
    when: expressionString.optional(),
});
exports.crosstabAxisSchema = zod_1.z.object({
    expression: expressionString,
    label: zod_1.z.string().max(60).default(''),
    widthMm: millimetreSize.default(0),
});
exports.crosstabMeasureSchema = zod_1.z.object({
    expression: expressionString,
    label: zod_1.z.string().max(60).default(''),
    fn: zod_1.z.enum(exports.AGGREGATE_FUNCTIONS).default('sum'),
    format: zod_1.z.string().max(60).default('#,##0.00'),
    blankWhenZero: zod_1.z.boolean().default(true),
});
exports.crosstabElementSchema = elementBase.extend({
    kind: zod_1.z.literal('CROSSTAB'),
    w: millimetreSize.positive(),
    h: millimetreSize.default(0),
    dataset: identifier,
    rowBy: expressionString,
    columnBy: expressionString,
    measure: expressionString,
    fn: zod_1.z.enum(exports.AGGREGATE_FUNCTIONS).default('sum'),
    format: zod_1.z.string().max(60).default('#,##0.00'),
    blankWhenZero: zod_1.z.boolean().default(true),
    measureLabel: zod_1.z.string().max(60).default(''),
    extraRowBys: zod_1.z.array(exports.crosstabAxisSchema).max(6).default([]),
    extraColumnBys: zod_1.z.array(exports.crosstabAxisSchema).max(4).default([]),
    extraMeasures: zod_1.z.array(exports.crosstabMeasureSchema).max(8).default([]),
    corner: expressionString.default(''),
    rowHeaderWidthMm: millimetreSize.default(40),
    columnWidthMm: millimetreSize.default(0),
    headerHeightMm: millimetreSize.default(6),
    rowHeightMm: millimetreSize.positive().default(5),
    showRowTotals: zod_1.z.boolean().default(true),
    showColumnTotals: zod_1.z.boolean().default(true),
    totalsLabel: zod_1.z.string().max(60).default('Total'),
    rowSort: zod_1.z.enum(exports.CROSSTAB_SORTS).default('LABEL_ASC'),
    columnSort: zod_1.z.enum(exports.CROSSTAB_SORTS).default('LABEL_ASC'),
    maxColumns: zod_1.z.number().int().min(1).max(200).default(12),
    overflow: zod_1.z.enum(exports.CROSSTAB_OVERFLOWS).default('FOLD'),
    overflowLabel: zod_1.z.string().max(60).default('Other'),
    font: exports.fontSchema.partial().optional(),
    headerFont: exports.fontSchema.partial().optional(),
    gridLines: zod_1.z.boolean().default(true),
    headerFill: hexColour.optional(),
    repeatHeader: zod_1.z.boolean().default(true),
});
exports.elementSchema = zod_1.z.discriminatedUnion('kind', [
    exports.textElementSchema,
    exports.fieldElementSchema,
    exports.lineElementSchema,
    exports.rectElementSchema,
    exports.imageElementSchema,
    exports.barcodeElementSchema,
    exports.qrcodeElementSchema,
    exports.pagebreakElementSchema,
    exports.crosstabElementSchema,
]);
exports.bandSchema = zod_1.z.object({
    type: zod_1.z.enum(exports.BAND_TYPES),
    heightMm: millimetreSize.default(0),
    heightRows: zod_1.z.number().int().min(0).max(500).optional(),
    dataset: identifier.optional(),
    groupBy: expressionString.optional(),
    groupLevel: zod_1.z.number().int().min(0).max(1).default(0),
    printOn: zod_1.z.enum(exports.PRINT_ON).default('ALL_PAGES'),
    autoGrow: zod_1.z.boolean().default(false),
    keepTogether: zod_1.z.boolean().default(false),
    keepWithNext: zod_1.z.boolean().default(false),
    keepWithLastDetail: zod_1.z.boolean().default(false),
    visible: expressionString.optional(),
    spacingRows: zod_1.z.number().int().min(0).max(20).default(0),
    elements: zod_1.z.array(exports.elementSchema).max(500).default([]),
});
exports.templateDefinitionSchema = zod_1.z
    .object({
    schemaVersion: zod_1.z.number().int().min(1).max(exports.SCHEMA_VERSION),
    layoutMode: zod_1.z.enum(exports.LAYOUT_MODES),
    meta: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    paper: exports.paperSchema,
    datasets: zod_1.z.array(exports.datasetSchema).max(20).default([]),
    bands: zod_1.z.array(exports.bandSchema).min(1).max(60),
})
    .superRefine((definition, ctx) => {
    const seenElementIds = new Set();
    for (const [bandIndex, band] of definition.bands.entries()) {
        for (const [elementIndex, element] of band.elements.entries()) {
            if (seenElementIds.has(element.id)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['bands', bandIndex, 'elements', elementIndex, 'id'],
                    message: `duplicate element id '${element.id}'`,
                });
            }
            seenElementIds.add(element.id);
        }
    }
    const datasetNames = new Set();
    for (const [index, dataset] of definition.datasets.entries()) {
        if (datasetNames.has(dataset.name)) {
            ctx.addIssue({
                code: 'custom',
                path: ['datasets', index, 'name'],
                message: `duplicate dataset name '${dataset.name}'`,
            });
        }
        datasetNames.add(dataset.name);
    }
    const rowBands = new Set(['DETAIL', 'GROUP_HEADER', 'GROUP_FOOTER']);
    for (const [bandIndex, band] of definition.bands.entries()) {
        if (band.dataset !== undefined && !datasetNames.has(band.dataset)) {
            ctx.addIssue({
                code: 'custom',
                path: ['bands', bandIndex, 'dataset'],
                message: `band references unknown dataset '${band.dataset}'`,
            });
        }
        if (rowBands.has(band.type) && band.dataset === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['bands', bandIndex, 'dataset'],
                message: `${band.type} requires a dataset`,
            });
        }
        if ((band.type === 'GROUP_HEADER' || band.type === 'GROUP_FOOTER') && !band.groupBy) {
            ctx.addIssue({
                code: 'custom',
                path: ['bands', bandIndex, 'groupBy'],
                message: `${band.type} requires groupBy`,
            });
        }
        for (const [elementIndex, element] of band.elements.entries()) {
            if (element.kind === 'FIELD' && element.aggregate?.dataset !== undefined) {
                if (!datasetNames.has(element.aggregate.dataset)) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['bands', bandIndex, 'elements', elementIndex, 'aggregate', 'dataset'],
                        message: `aggregate references unknown dataset '${element.aggregate.dataset}'`,
                    });
                }
            }
            if (element.kind === 'FIELD' &&
                element.aggregate?.scope === 'GROUP' &&
                band.type !== 'GROUP_FOOTER' &&
                band.type !== 'GROUP_HEADER') {
                ctx.addIssue({
                    code: 'custom',
                    path: ['bands', bandIndex, 'elements', elementIndex, 'aggregate', 'scope'],
                    message: 'GROUP-scoped aggregates are only valid inside a GROUP_HEADER or GROUP_FOOTER',
                });
            }
        }
    }
    const cardinalityByName = new Map(definition.datasets.map((dataset) => [dataset.name, dataset.cardinality]));
    for (const [bandIndex, band] of definition.bands.entries()) {
        if (band.dataset && cardinalityByName.get(band.dataset) === 'one') {
            ctx.addIssue({
                code: 'custom',
                path: ['bands', bandIndex, 'dataset'],
                message: `band repeats over '${band.dataset}', which the template declares as cardinality 'one'`,
            });
        }
    }
    const singletonBands = [
        'REPORT_HEADER',
        'PAGE_HEADER',
        'PAGE_FOOTER',
        'SUMMARY',
        'REPORT_FOOTER',
        'NO_DATA',
    ];
    for (const bandType of singletonBands) {
        const occurrences = definition.bands.filter((band) => band.type === bandType);
        if (occurrences.length > 1) {
            ctx.addIssue({
                code: 'custom',
                path: ['bands'],
                message: `${bandType} may appear at most once (found ${occurrences.length})`,
            });
        }
    }
    for (const [bandIndex, band] of definition.bands.entries()) {
        for (const [elementIndex, element] of band.elements.entries()) {
            if (element.kind !== 'CROSSTAB') {
                continue;
            }
            if (!exports.CROSSTAB_BANDS.includes(band.type)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['bands', bandIndex, 'elements', elementIndex],
                    message: `a CROSSTAB cannot sit in a ${band.type} band; use one of ${exports.CROSSTAB_BANDS.join(', ')}`,
                });
            }
            if (definition.layoutMode === 'GRID') {
                ctx.addIssue({
                    code: 'custom',
                    path: ['bands', bandIndex, 'elements', elementIndex],
                    message: 'CROSSTAB is a GRAPHIC-mode element; GRID stationery cannot size its columns',
                });
            }
            if (!definition.datasets.some((dataset) => dataset.name === element.dataset)) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['bands', bandIndex, 'elements', elementIndex, 'dataset'],
                    message: `unknown dataset '${element.dataset}'`,
                });
            }
            if (element.rowHeaderWidthMm >= element.w) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['bands', bandIndex, 'elements', elementIndex, 'rowHeaderWidthMm'],
                    message: 'the row-label column leaves no width for the data columns',
                });
            }
            for (const [axisIndex, axis] of element.extraRowBys.entries()) {
                if (!axis.expression.trim()) {
                    ctx.addIssue({
                        code: 'custom',
                        path: [
                            'bands',
                            bandIndex,
                            'elements',
                            elementIndex,
                            'extraRowBys',
                            axisIndex,
                            'expression',
                        ],
                        message: 'a row level needs an expression',
                    });
                }
            }
            for (const [axisIndex, axis] of element.extraColumnBys.entries()) {
                if (!axis.expression.trim()) {
                    ctx.addIssue({
                        code: 'custom',
                        path: [
                            'bands',
                            bandIndex,
                            'elements',
                            elementIndex,
                            'extraColumnBys',
                            axisIndex,
                            'expression',
                        ],
                        message: 'a column level needs an expression',
                    });
                }
            }
            for (const [measureIndex, measure] of element.extraMeasures.entries()) {
                if (!measure.expression.trim()) {
                    ctx.addIssue({
                        code: 'custom',
                        path: [
                            'bands',
                            bandIndex,
                            'elements',
                            elementIndex,
                            'extraMeasures',
                            measureIndex,
                            'expression',
                        ],
                        message: 'a measure needs an expression',
                    });
                }
            }
        }
    }
    if (definition.layoutMode === 'GRID') {
        if (definition.paper.columns === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['paper', 'columns'],
                message: 'GRID layout requires paper.columns',
            });
        }
        for (const [bandIndex, band] of definition.bands.entries()) {
            for (const [elementIndex, element] of band.elements.entries()) {
                if (element.kind === 'LINE' || element.kind === 'PAGEBREAK') {
                    continue;
                }
                if (element.col === undefined || element.row === undefined) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['bands', bandIndex, 'elements', elementIndex],
                        message: 'GRID layout requires col and row on every element',
                    });
                }
                if (definition.paper.columns !== undefined &&
                    element.col !== undefined &&
                    element.cols !== undefined &&
                    element.col + element.cols > definition.paper.columns) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['bands', bandIndex, 'elements', elementIndex, 'cols'],
                        message: `element runs past column ${definition.paper.columns}`,
                    });
                }
            }
        }
    }
    else {
        const { paper } = definition;
        const printableWidth = paper.widthMm - paper.margins.left - paper.margins.right;
        if (printableWidth <= 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['paper', 'margins'],
                message: 'horizontal margins leave no printable width',
            });
        }
        for (const [bandIndex, band] of definition.bands.entries()) {
            for (const [elementIndex, element] of band.elements.entries()) {
                const right = element.kind === 'LINE'
                    ? Math.max(element.x1, element.x2)
                    : element.kind === 'QRCODE'
                        ? element.x + element.size
                        : element.x + (element.w ?? 0);
                if (right > paper.widthMm + 0.01) {
                    ctx.addIssue({
                        code: 'custom',
                        path: ['bands', bandIndex, 'elements', elementIndex, 'x'],
                        message: `element extends to ${right.toFixed(1)}mm, past the ${paper.widthMm}mm page width`,
                    });
                }
            }
        }
    }
});
const isTextLike = (element) => element.kind === 'TEXT' || element.kind === 'FIELD';
exports.isTextLike = isTextLike;
//# sourceMappingURL=template-definition.schema.js.map