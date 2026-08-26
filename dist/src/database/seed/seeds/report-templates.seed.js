"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportTemplatesSeed = void 0;
const gallery_index_1 = require("../../../modules/reporting/templates/gallery/gallery.index");
const template_definition_schema_1 = require("../../../modules/reporting/templates/dto/template-definition.schema");
const COORDINATE_PRECISION = 1e6;
const canonicalise = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION
            : value;
    }
    if (Array.isArray(value)) {
        return value.map(canonicalise);
    }
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value)
            .filter(([, entry]) => entry !== undefined)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
            .map(([key, entry]) => [key, canonicalise(entry)]));
    }
    return value;
};
const sameDefinition = (left, right) => JSON.stringify(canonicalise(left)) === JSON.stringify(canonicalise(right));
const galleryKeyOf = (definition) => {
    if (definition === null || typeof definition !== 'object') {
        return null;
    }
    const meta = definition.meta;
    if (meta === null || typeof meta !== 'object') {
        return null;
    }
    const key = meta.gallery;
    return typeof key === 'string' ? key : null;
};
exports.reportTemplatesSeed = {
    name: 'report-template-gallery',
    version: '1.0.0',
    mode: 'always',
    description: 'System print templates: A4/A5 GST invoice, 58/80mm thermal, dot matrix, statement',
    async run(prisma) {
        for (const entry of gallery_index_1.GALLERY_TEMPLATES) {
            const parsed = template_definition_schema_1.templateDefinitionSchema.safeParse(entry.build());
            if (!parsed.success) {
                const issues = parsed.error.issues
                    .slice(0, 5)
                    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                    .join('; ');
                throw new Error(`Gallery template '${entry.key}' is not valid: ${issues}`);
            }
            const definition = parsed.data;
            const definitionJson = definition;
            const systemTemplates = await prisma.printTemplate.findMany({
                where: {
                    ptCompanyId: null,
                    ptDocType: entry.docType,
                    ptOutputMode: entry.outputMode,
                    ptPaperCode: entry.paperCode,
                    ptIsDeleted: false,
                },
            });
            const existing = systemTemplates.find((template) => galleryKeyOf(template.ptDefinition) === entry.key);
            if (!existing) {
                await prisma.$transaction(async (transaction) => {
                    if (entry.isDefault) {
                        await transaction.printTemplate.updateMany({
                            where: {
                                ptCompanyId: null,
                                ptBranchId: null,
                                ptDocType: entry.docType,
                                ptOutputMode: entry.outputMode,
                                ptPaperCode: entry.paperCode,
                                ptIsDefault: true,
                                ptIsDeleted: false,
                            },
                            data: { ptIsDefault: false },
                        });
                    }
                    await transaction.printTemplate.create({
                        data: {
                            ptCompanyId: null,
                            ptBranchId: null,
                            ptDocType: entry.docType,
                            ptOutputMode: entry.outputMode,
                            ptPaperCode: entry.paperCode,
                            ptName: entry.name,
                            ptVersion: 1,
                            ptSchemaVer: definition.schemaVersion,
                            ptDefinition: definitionJson,
                            ptIsDefault: entry.isDefault,
                            ptIsActive: true,
                        },
                    });
                });
                console.log(`[seed] report template '${entry.key}' created`);
                continue;
            }
            const unchanged = sameDefinition(existing.ptDefinition, definition);
            if (unchanged && existing.ptName === entry.name) {
                continue;
            }
            await prisma.$transaction(async (transaction) => {
                await transaction.printTemplateRevision.create({
                    data: {
                        ptrTemplateId: existing.ptId,
                        ptrVersion: existing.ptVersion,
                        ptrSchemaVer: existing.ptSchemaVer,
                        ptrDefinition: existing.ptDefinition,
                        ptrNote: `superseded by gallery seed v${exports.reportTemplatesSeed.version}`,
                    },
                });
                await transaction.printTemplate.update({
                    where: { ptId: existing.ptId },
                    data: {
                        ptName: entry.name,
                        ptDefinition: definitionJson,
                        ptSchemaVer: definition.schemaVersion,
                        ptVersion: existing.ptVersion + 1,
                        ptModifiedOn: new Date(),
                    },
                });
            });
            console.log(`[seed] report template '${entry.key}' updated to version ${existing.ptVersion + 1}`);
        }
    },
};
//# sourceMappingURL=report-templates.seed.js.map