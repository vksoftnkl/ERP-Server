"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMessagesSeed = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const FILE = 'Error_Messages.json';
function cataloguePath() {
    const candidates = [
        (0, node_path_1.resolve)(process.cwd(), 'prisma', 'seed', FILE),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', '..', 'prisma', 'seed', FILE),
        (0, node_path_1.resolve)(__dirname, '..', '..', '..', '..', '..', 'prisma', 'seed', FILE),
    ];
    return candidates.find((p) => (0, node_fs_1.existsSync)(p)) ?? null;
}
function readCatalogue() {
    const path = cataloguePath();
    if (!path) {
        return null;
    }
    const parsed = JSON.parse((0, node_fs_1.readFileSync)(path, 'utf8'));
    if (typeof parsed.version !== 'string' || !Array.isArray(parsed.rows)) {
        throw new Error(`${FILE}: expected { version, rows[] }`);
    }
    return parsed;
}
exports.errorMessagesSeed = {
    name: 'error-messages',
    get version() {
        return readCatalogue()?.version ?? 'missing';
    },
    mode: 'once',
    description: 'Plain error wording (notes 120) from prisma/seed/Error_Messages.json',
    async run(prisma) {
        const catalogue = readCatalogue();
        if (!catalogue) {
            return;
        }
        const rows = catalogue.rows.map((r) => ({
            code: r.code.trim(),
            variant: (r.variant ?? '').trim(),
            lang: (r.lang ?? 'en').trim() || 'en',
            title: r.title.trim(),
            line: r.line.trim(),
            todo: r.todo.trim(),
        }));
        const now = new Date();
        await prisma.$transaction(async (tx) => {
            for (const r of rows) {
                await tx.errorMessage.upsert({
                    where: {
                        ermCode_ermVariant_ermLang: {
                            ermCode: r.code,
                            ermVariant: r.variant,
                            ermLang: r.lang,
                        },
                    },
                    create: {
                        ermCode: r.code,
                        ermVariant: r.variant,
                        ermLang: r.lang,
                        ermTitle: r.title,
                        ermLine: r.line,
                        ermTodo: r.todo,
                    },
                    update: {
                        ermTitle: r.title,
                        ermLine: r.line,
                        ermTodo: r.todo,
                        ermIsActive: true,
                        ermModifiedOn: now,
                    },
                });
            }
            const kept = new Set(rows.map((r) => `${r.code}|${r.variant}|${r.lang}`));
            const live = await tx.errorMessage.findMany({
                where: { ermIsActive: true },
                select: { ermId: true, ermCode: true, ermVariant: true, ermLang: true },
            });
            const gone = live.filter((r) => !kept.has(`${r.ermCode}|${r.ermVariant}|${r.ermLang}`));
            if (gone.length > 0) {
                await tx.errorMessage.updateMany({
                    where: { ermId: { in: gone.map((r) => r.ermId) } },
                    data: { ermIsActive: false, ermModifiedOn: now },
                });
            }
            await tx.errorMessageCatalogue.upsert({
                where: { emcId: 1 },
                create: { emcId: 1, emcVersion: catalogue.version, emcRowCount: rows.length },
                update: { emcVersion: catalogue.version, emcRowCount: rows.length, emcLoadedOn: now },
            });
        }, { timeout: 60_000 });
    },
};
//# sourceMappingURL=error-messages.seed.js.map