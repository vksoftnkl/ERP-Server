"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintRenderDefinitionError = void 0;
exports.assertRenderableEngine = assertRenderableEngine;
exports.buildDefinition = buildDefinition;
exports.buildDefinitionFromBody = buildDefinitionFromBody;
const print_render_constants_1 = require("../print-render.constants");
const paper_presets_1 = require("./paper-presets");
const template_definition_schema_1 = require("./template-definition.schema");
class PrintRenderDefinitionError extends Error {
    details;
    constructor(message, details) {
        super(message);
        this.details = details;
        this.name = 'PrintRenderDefinitionError';
    }
}
exports.PrintRenderDefinitionError = PrintRenderDefinitionError;
const toMm = (value) => {
    if (value === null || value === undefined)
        return null;
    return typeof value === 'number' ? value : value.toNumber();
};
const toMmOrZero = (value) => toMm(value) ?? 0;
function assertRenderableEngine(engine) {
    if (print_render_constants_1.RENDERABLE_ENGINES.includes(engine)) {
        return engine;
    }
    const reason = {
        HTML_CSS: 'an HTML body needs a browser to lay out, and this server deliberately does not embed one',
        QTRPT_XML: "3.0's report format is kept so a migration can read it, and is not rendered directly",
        RAW: 'a RAW body is bytes the server must not interpret — send it to the device unchanged',
    };
    throw new PrintRenderDefinitionError(`This revision cannot be rendered: its engine is ${engine}`, [
        {
            field: 'ptvEngine',
            message: `${engine} has no renderer — ${reason[engine] ?? 'it is not a format this server draws'}. ` +
                `Renderable engines are ${print_render_constants_1.RENDERABLE_ENGINES.join(' and ')}.`,
        },
    ]);
}
function parseBody(version) {
    let parsed;
    try {
        parsed = JSON.parse(version.ptvBody);
    }
    catch (error) {
        throw new PrintRenderDefinitionError('The stored design is not valid JSON', [
            {
                field: 'ptvBody',
                message: `Revision ${version.ptvId} holds a body that does not parse as JSON: ` +
                    `${error instanceof Error ? error.message : String(error)}. ` +
                    'Open it in the designer and save it again.',
            },
        ]);
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new PrintRenderDefinitionError('The stored design is not a design', [
            {
                field: 'ptvBody',
                message: 'A JSON_BANDS body must be a JSON OBJECT holding a `bands` array. ' +
                    `This one is ${Array.isArray(parsed) ? 'an array' : typeof parsed}.`,
            },
        ]);
    }
    return parsed;
}
function paperFor(version) {
    const preset = (0, paper_presets_1.findPaperPreset)(version.ptvPaperCode) ?? paper_presets_1.DEFAULT_PAPER;
    const widthMm = toMm(version.ptvWidthMm) ?? preset.widthMm;
    const heightMm = version.ptvHeightMm !== null ? toMm(version.ptvHeightMm) : preset.heightMm;
    const columns = version.ptvColumns ?? preset.columns;
    return {
        code: version.ptvPaperCode || preset.code,
        widthMm,
        heightMm,
        orientation: version.ptvOrientation === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT',
        margins: {
            top: toMmOrZero(version.ptvMarginTopMm),
            right: toMmOrZero(version.ptvMarginRightMm),
            bottom: toMmOrZero(version.ptvMarginBottomMm),
            left: toMmOrZero(version.ptvMarginLeftMm),
        },
        ...(columns !== undefined && columns !== null ? { columns } : {}),
        ...(preset.rows !== undefined ? { rows: preset.rows } : {}),
    };
}
function datasetsFor(datasets) {
    return datasets.map((dataset) => ({
        name: dataset.ptdName,
        provider: dataset.ptdSourceKind === 'SQL'
            ? `sql.${dataset.ptdName}`
            : (dataset.ptdProviderCode ?? `sql.${dataset.ptdName}`),
        cardinality: dataset.ptdRole === 'MASTER' ? 'one' : 'many',
    }));
}
function buildDefinition(version, datasets) {
    const engine = assertRenderableEngine(version.ptvEngine);
    const layoutMode = print_render_constants_1.LAYOUT_MODE_FOR_ENGINE[engine];
    const body = parseBody(version);
    const candidate = {
        schemaVersion: version.ptvSchemaVer,
        layoutMode,
        ...(typeof body.meta === 'object' && body.meta !== null && !Array.isArray(body.meta)
            ? { meta: body.meta }
            : {}),
        paper: paperFor(version),
        datasets: datasetsFor(datasets),
        bands: (body.bands ?? []),
    };
    if (!Array.isArray(candidate.bands) || candidate.bands.length === 0) {
        throw new PrintRenderDefinitionError('This revision has no design yet', [
            {
                field: 'bands',
                message: `Revision ${version.ptvRevNo} holds no bands, which is what a design looks like before ` +
                    'anything has been drawn on it. Open it in the designer, add at least one band, and ' +
                    'save.',
            },
        ]);
    }
    const parsed = template_definition_schema_1.templateDefinitionSchema.safeParse(candidate);
    if (!parsed.success) {
        throw new PrintRenderDefinitionError('The stored design cannot be rendered as it stands', parsed.error.issues.map((issue) => ({
            field: issue.path.length > 0 ? issue.path.join('.') : 'ptvBody',
            message: issue.message,
        })));
    }
    return { definition: parsed.data, layoutMode, engine };
}
function buildDefinitionFromBody(version, datasets, body) {
    return buildDefinition({ ...version, ptvBody: JSON.stringify(body) }, datasets);
}
//# sourceMappingURL=definition-from-version.js.map