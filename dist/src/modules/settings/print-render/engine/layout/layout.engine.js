"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LayoutEngine = void 0;
const common_1 = require("@nestjs/common");
const template_definition_schema_1 = require("../../definition/template-definition.schema");
const expression_evaluator_1 = require("../expression/expression.evaluator");
const text_1 = require("../expression/transforms/text");
const chart_1 = require("./chart");
const markup_1 = require("./markup");
const shapes_1 = require("./shapes");
const aggregate_accumulator_1 = require("./aggregate.accumulator");
const text_measure_1 = require("./text-measure");
const crosstab_1 = require("./crosstab");
const flow_layout_1 = require("./flow-layout");
const MAX_PAGES = 2_000;
const MAX_DETAIL_ROWS = 100_000;
let LayoutEngine = class LayoutEngine {
    measurer;
    constructor(measurer) {
        this.measurer = measurer;
    }
    render(input) {
        const startedAt = Date.now();
        const reportPages = [
            ...new Set(input.definition.bands.map((band) => band.reportPage ?? 0)),
        ].sort((left, right) => left - right);
        if (reportPages.length <= 1) {
            return new LayoutRun(this.measurer, input).run(startedAt);
        }
        const trees = reportPages.map((reportPage) => new LayoutRun(this.measurer, {
            ...input,
            definition: {
                ...input.definition,
                bands: input.definition.bands.filter((band) => (band.reportPage ?? 0) === reportPage),
            },
        }).run(startedAt));
        const pages = [];
        for (const tree of trees) {
            for (const page of tree.pages) {
                pages.push({ index: pages.length, primitives: page.primitives });
            }
        }
        return {
            pageCount: pages.length,
            paper: trees[0].paper,
            layoutMode: trees[0].layoutMode,
            pages,
            warnings: trees.flatMap((tree) => tree.warnings),
            stats: {
                detailRows: trees.reduce((total, tree) => total + tree.stats.detailRows, 0),
                bandsEmitted: trees.reduce((total, tree) => total + tree.stats.bandsEmitted, 0),
                durationMs: Date.now() - startedAt,
            },
        };
    }
};
exports.LayoutEngine = LayoutEngine;
exports.LayoutEngine = LayoutEngine = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [text_measure_1.TextMeasurer])
], LayoutEngine);
class LayoutRun {
    measurer;
    definition;
    paper;
    evaluator = new expression_evaluator_1.ExpressionEvaluator();
    warnings = [];
    pages = [];
    deferred = [];
    pageAggregates = new aggregate_accumulator_1.PageAggregates();
    precomputed = new aggregate_accumulator_1.PrecomputedAggregates();
    currentPage = null;
    cursorMm = 0;
    openGroups = [];
    detailRowsEmitted = 0;
    bandsEmitted = 0;
    bodyHeightMm = 0;
    pageHeaderHeightMm = 0;
    pageFooterHeightMm = 0;
    crosstabPlans = new Map();
    headerPrimitiveCounts = [];
    footerPrimitiveCounts = [];
    numberingStarts = [];
    restartNumberingOnNextPage = false;
    markupCache = new Map();
    bandsByType;
    rootContext;
    constructor(measurer, input) {
        this.measurer = measurer;
        this.definition = input.definition;
        this.paper = input.definition.paper;
        this.bandsByType = new Map();
        for (const band of input.definition.bands) {
            const bucket = this.bandsByType.get(band.type);
            if (bucket) {
                bucket.push(band);
            }
            else {
                this.bandsByType.set(band.type, [band]);
            }
        }
        this.rootContext = {
            ...input.datasets,
            ctx: input.ctx,
            sys: input.sys ?? { now: new Date().toISOString() },
            page: { number: 1, total: 1, isFirst: true, isLast: true },
            agg: {},
            group: { key: '', level: 0, count: 0 },
            row: {},
        };
    }
    run(startedAt) {
        this.computePageGeometry();
        const sections = this.collectDetailSections();
        this.prePass(sections);
        this.startPage();
        let noDataEmitted = false;
        for (const band of this.definition.bands) {
            switch (band.type) {
                case 'PAGE_HEADER':
                case 'PAGE_FOOTER':
                case 'GROUP_HEADER':
                case 'GROUP_FOOTER':
                case 'NO_DATA':
                    break;
                case 'DETAIL': {
                    const section = sections.find((candidate) => candidate.band === band);
                    if (!section) {
                        break;
                    }
                    if (section.rows.length > 0) {
                        this.emitDetailSection(section);
                    }
                    else if (!noDataEmitted) {
                        noDataEmitted = this.emitBandIfPresent('NO_DATA');
                    }
                    break;
                }
                default:
                    this.emitBand(band, this.rootContext);
                    break;
            }
        }
        this.finishPage();
        this.resolveDeferredText();
        if (this.pages.length === 0) {
            this.pages.push({ index: 0, primitives: [] });
        }
        this.drawPageBorders();
        this.drawWatermarks();
        for (const failure of this.evaluator.getFailures()) {
            this.warnings.push({
                kind: 'expression',
                message: `Expression failed: ${failure.message}`,
                detail: failure.expression,
            });
        }
        return {
            pageCount: this.pages.length,
            paper: this.paper,
            layoutMode: this.definition.layoutMode,
            pages: this.pages,
            warnings: this.warnings,
            stats: {
                detailRows: this.detailRowsEmitted,
                bandsEmitted: this.bandsEmitted,
                durationMs: Date.now() - startedAt,
            },
        };
    }
    collectDetailSections() {
        const sections = [];
        for (const band of this.definition.bands) {
            if (band.type !== 'DETAIL' || !band.dataset) {
                continue;
            }
            const rows = this.rowsOf(band.dataset);
            if (rows.length > MAX_DETAIL_ROWS) {
                this.warnings.push({
                    kind: 'row-limit',
                    message: `Dataset '${band.dataset}' truncated at ${MAX_DETAIL_ROWS} rows`,
                    detail: `${rows.length} rows were resolved`,
                });
            }
            const groupHeaders = this.bandsByLevel('GROUP_HEADER', band.dataset);
            const groupFooters = this.bandsByLevel('GROUP_FOOTER', band.dataset);
            const levels = Math.max(groupHeaders.length, groupFooters.length);
            sections.push({
                band,
                rows: rows.slice(0, MAX_DETAIL_ROWS),
                groupHeaders,
                groupFooters,
                groupBy: Array.from({ length: levels }, (_unused, level) => groupHeaders[level]?.groupBy ?? groupFooters[level]?.groupBy),
                rowGroupPaths: [],
            });
        }
        return sections;
    }
    computePageGeometry() {
        const pageHeader = this.firstBand('PAGE_HEADER');
        const pageFooter = this.firstBand('PAGE_FOOTER');
        this.pageHeaderHeightMm = pageHeader ? this.bandHeight(pageHeader, this.rootContext) : 0;
        this.pageFooterHeightMm = pageFooter ? this.bandHeight(pageFooter, this.rootContext) : 0;
        const isGrid = this.definition.layoutMode === 'GRID';
        const pageExtent = isGrid ? (this.paper.rows ?? null) : this.paper.heightMm;
        const unit = isGrid ? 'lines' : 'mm';
        if (pageExtent === null) {
            this.bodyHeightMm = Number.POSITIVE_INFINITY;
            return;
        }
        const margins = isGrid ? 0 : this.paper.margins.top + this.paper.margins.bottom;
        const usable = pageExtent - margins - this.pageHeaderHeightMm - this.pageFooterHeightMm;
        if (usable <= 0) {
            this.warnings.push({
                kind: 'overflow',
                message: 'Page header, page footer and margins consume the whole page',
                detail: `page ${pageExtent}${unit}, header ${this.pageHeaderHeightMm.toFixed(1)}${unit}, ` +
                    `footer ${this.pageFooterHeightMm.toFixed(1)}${unit}`,
            });
        }
        this.bodyHeightMm = Math.max(usable, 1);
    }
    prePass(sections) {
        this.precomputed = new aggregate_accumulator_1.PrecomputedAggregates();
        const aggregateElements = this.collectAggregateElements(sections);
        for (const section of sections) {
            const { rows, groupBy } = section;
            const applicable = aggregateElements.filter((element) => element.dataset === section.band.dataset);
            rows.forEach((row, index) => {
                const context = this.rowContext(row, index, rows.length, []);
                const keys = groupBy.map((expression) => this.evaluator.evaluateText(expression, context));
                section.rowGroupPaths.push(keys);
                for (const element of applicable) {
                    const value = this.evaluator.evaluateNumber(element.value, context);
                    this.precomputed.addReport(element.id, value);
                    for (let level = 0; level < keys.length; level += 1) {
                        this.precomputed.addGroup((0, aggregate_accumulator_1.buildGroupPath)(keys.slice(0, level + 1)), element.id, value);
                    }
                }
            });
        }
    }
    collectAggregateElements(sections) {
        const sectionDatasets = [
            ...new Set(sections
                .map((section) => section.band.dataset)
                .filter((dataset) => dataset !== undefined)),
        ];
        const soleDataset = sectionDatasets.length === 1 ? sectionDatasets[0] : undefined;
        const collected = [];
        for (const band of this.definition.bands) {
            for (const element of band.elements) {
                if (element.kind !== 'FIELD' || !element.aggregate) {
                    continue;
                }
                const dataset = element.aggregate.dataset ?? band.dataset ?? soleDataset;
                if (!dataset) {
                    this.warnings.push({
                        kind: 'missing-dataset',
                        message: `Aggregate on element '${element.id}' does not say which dataset to total, ` +
                            'and the template has more than one repeating dataset',
                        detail: `candidates: ${sectionDatasets.join(', ')}`,
                    });
                    continue;
                }
                collected.push({ id: element.id, value: element.aggregate.over ?? element.value, dataset });
            }
        }
        return collected;
    }
    emitDetailSection(section) {
        const { band: detailBand, rows, groupHeaders, groupFooters } = section;
        const summaryBand = this.firstBand('SUMMARY');
        const pageAggregateElements = this.pageScopeElementsFor(section);
        this.openGroups = [];
        rows.forEach((row, index) => {
            const keys = section.rowGroupPaths[index] ?? [];
            const isLastRow = index === rows.length - 1;
            let changedFrom = keys.length;
            for (let level = 0; level < keys.length; level += 1) {
                const open = this.openGroups[level];
                if (!open || open.key !== keys[level]) {
                    changedFrom = level;
                    break;
                }
            }
            if (changedFrom < this.openGroups.length) {
                this.closeGroupsFrom(changedFrom, groupFooters);
            }
            for (let level = changedFrom; level < keys.length; level += 1) {
                const path = (0, aggregate_accumulator_1.buildGroupPath)(keys.slice(0, level + 1));
                this.openGroups[level] = { level, key: keys[level], path, rowCount: 0 };
                const headerBand = groupHeaders[level];
                if (headerBand) {
                    this.emitBand(headerBand, this.rowContext(row, index, rows.length, keys.slice(0, level + 1)));
                }
            }
            for (const open of this.openGroups) {
                open.rowCount += 1;
            }
            const context = this.rowContext(row, index, rows.length, keys);
            const reserveMm = isLastRow && summaryBand?.keepWithLastDetail
                ? this.bandHeight(summaryBand, this.rootContext) +
                    this.closingFootersHeight(groupFooters, context)
                : 0;
            this.emitBand(detailBand, context, { reserveMm });
            this.detailRowsEmitted += 1;
            this.accumulatePageAggregates(pageAggregateElements, context);
        });
        this.closeGroupsFrom(0, groupFooters);
    }
    closeGroupsFrom(level, groupFooters) {
        for (let index = this.openGroups.length - 1; index >= level; index -= 1) {
            const open = this.openGroups[index];
            if (!open) {
                continue;
            }
            const footerBand = groupFooters[index];
            if (footerBand) {
                this.emitBand(footerBand, this.groupContext(open));
            }
        }
        this.openGroups = this.openGroups.slice(0, level);
    }
    pageScopeElementsFor(section) {
        const elements = [];
        for (const band of this.definition.bands) {
            for (const element of band.elements) {
                if (element.kind !== 'FIELD' || element.aggregate?.scope !== 'PAGE') {
                    continue;
                }
                const dataset = element.aggregate.dataset ?? band.dataset;
                if (dataset === undefined || dataset === section.band.dataset) {
                    elements.push({ id: element.id, value: element.aggregate.over ?? element.value });
                }
            }
        }
        return elements;
    }
    closingFootersHeight(groupFooters, context) {
        return this.openGroups.reduce((total, open) => {
            const footerBand = open ? groupFooters[open.level] : undefined;
            return footerBand ? total + this.bandHeight(footerBand, context) : total;
        }, 0);
    }
    accumulatePageAggregates(applicable, context) {
        for (const element of applicable) {
            this.pageAggregates.add(element.id, this.evaluator.evaluateNumber(element.value, context));
        }
    }
    emitBandIfPresent(type) {
        const band = this.firstBand(type);
        if (!band) {
            return false;
        }
        this.emitBand(band, this.rootContext);
        return true;
    }
    emitBand(band, context, options = {}) {
        if (!this.evaluator.evaluateCondition(band.visible, context)) {
            return;
        }
        this.startFreshPageIfAsked(band);
        const heightMm = this.bandHeight(band, context);
        const reserveMm = options.reserveMm ?? 0;
        const flow = this.flowLayoutFor(band, context);
        const crosstab = this.soleCrosstab(band, context);
        const keptWhole = flow !== null && band.keepTogether && heightMm + reserveMm <= this.bodyHeightMm;
        if (crosstab && !keptWhole && !this.fitsInRemainingBody(heightMm + reserveMm)) {
            this.emitCrosstabBand(band, context, crosstab, reserveMm, flow);
            return;
        }
        if (this.needsPageBreak(heightMm + reserveMm)) {
            this.finishPage();
            this.startPage();
        }
        const bandTopMm = this.bodyTopMm() + this.cursorMm;
        this.drawBandElements(band, context, bandTopMm, {
            placed: flow?.elements,
            stretchMm: this.stretchOf(band, heightMm),
        });
        this.cursorMm += heightMm;
        this.bandsEmitted += 1;
        if (this.bandRequestsPageBreak(band, context)) {
            this.finishPage();
            this.startPage();
        }
    }
    startFreshPageIfAsked(band) {
        if ((!band.startNewPage && !band.startNewNumeration) || !this.currentPage) {
            return;
        }
        if (this.cursorMm > flow_layout_1.FLOW_EPSILON_MM) {
            this.restartNumberingOnNextPage = band.startNewNumeration;
            this.finishPage();
            this.startPage();
        }
        else if (band.startNewNumeration) {
            this.numberingStarts[this.currentPage.index] = this.currentPage.index;
        }
    }
    stretchOf(band, heightMm) {
        if (this.definition.layoutMode === 'GRID') {
            return 0;
        }
        return Math.max(0, heightMm - this.spacingMm(band) - band.heightMm);
    }
    soleCrosstab(band, context) {
        const found = band.elements.filter((element) => element.kind === 'CROSSTAB' && this.evaluator.evaluateCondition(element.visible, context));
        return found.length === 1 ? found[0] : null;
    }
    flowLayoutFor(band, context) {
        if (!band.flowLayout || this.definition.layoutMode === 'GRID') {
            return null;
        }
        return (0, flow_layout_1.applyFlowLayout)(band, (element) => this.evaluator.evaluateCondition(element.visible, context), (element) => this.crosstabPlanFor(element, context).fullHeightMm);
    }
    crosstabPlanFor(element, context) {
        const cached = this.crosstabPlans.get(element.id);
        if (cached) {
            return cached;
        }
        const rows = this.rowsOf(element.dataset);
        const model = (0, crosstab_1.buildCrosstabModel)(element, rows, {
            text: (expression, row, index, total) => this.evaluator.evaluateText(expression, this.crosstabRowContext(context, row, index, total)),
            number: (expression, row, index, total) => this.evaluator.evaluateNumber(expression, this.crosstabRowContext(context, row, index, total)),
        });
        const plan = (0, crosstab_1.planCrosstab)(element, model, this.measurer);
        this.crosstabPlans.set(element.id, plan);
        if (plan.columnsCutForWidth > 0) {
            this.warnings.push({
                kind: 'overflow',
                message: `Crosstab '${element.id}' dropped ${plan.columnsCutForWidth} column(s) that did not fit its ${element.w}mm width`,
                detail: 'Widen the element, narrow columnWidthMm, or lower maxColumns.',
            });
        }
        if (model.droppedColumns > 0) {
            this.warnings.push({
                kind: 'overflow',
                message: `Crosstab '${element.id}' clipped ${model.droppedColumns} column(s) past maxColumns=${element.maxColumns}`,
                detail: 'Its totals describe only the printed columns; set overflow to FOLD to keep them whole.',
            });
        }
        return plan;
    }
    crosstabRowContext(context, row, index, totalRows) {
        return { ...context, row: this.rowValue(row, index, totalRows) };
    }
    drawCrosstab(plan, context, xMm, yMm, slice) {
        if (!this.currentPage) {
            return;
        }
        const { element } = plan;
        const primitives = (0, crosstab_1.emitCrosstab)(plan, {
            xMm,
            yMm,
            slice,
            cornerText: this.evaluator.evaluateText(element.corner, context),
            strokeColour: this.resolveColour(element.style?.stroke, context, '#000000'),
            textColour: this.resolveColour(element.style?.color, context, '#000000'),
            headerFill: element.headerFill
                ? this.resolveColour(element.headerFill, context, '#eeeeee')
                : null,
            totalsFill: element.totalsFill
                ? this.resolveColour(element.totalsFill, context, '#eeeeee')
                : null,
        });
        this.currentPage.primitives.push(...primitives);
    }
    emitCrosstabBand(band, context, element, reserveMm, flow) {
        const plan = this.crosstabPlanFor(element, context);
        const placedTable = flow?.elements.find((placed) => placed.id === element.id);
        const offsetMm = placedTable ? placedTable.y : this.elementY(element);
        const tableEndInBandMm = offsetMm + plan.fullHeightMm;
        const trailing = flow
            ? flow.elements.filter((placed) => placed.positionType === 'FLOAT' &&
                placed.id !== element.id &&
                (0, flow_layout_1.verticalSpan)(placed)[0] >= tableEndInBandMm - flow_layout_1.FLOW_EPSILON_MM)
            : [];
        const leading = flow?.elements.filter((placed) => !trailing.includes(placed));
        if (this.needsPageBreak(offsetMm + plan.headerHeightMm + plan.rowHeightMm + reserveMm)) {
            this.finishPage();
            this.startPage();
        }
        const bandTopMm = this.bodyTopMm() + this.cursorMm;
        this.drawBandElements(band, context, bandTopMm, {
            skipCrosstabId: element.id,
            placed: leading,
        });
        this.bandsEmitted += 1;
        let tableTopMm = bandTopMm + offsetMm;
        let fromRow = 0;
        let withHeader = true;
        let pagesBroken = 0;
        for (let guard = 0; guard <= MAX_PAGES; guard += 1) {
            if (!this.currentPage) {
                return;
            }
            const availableMm = this.bodyTopMm() + this.bodyHeightMm - tableTopMm;
            let slice = (0, crosstab_1.sliceCrosstab)(plan, fromRow, availableMm, withHeader);
            const rowsRemain = fromRow < plan.model.rows.length;
            if (slice.rowCount === 0 && rowsRemain) {
                if (pagesBroken > 0 && tableTopMm <= this.bodyTopMm() + 0.001) {
                    this.warnings.push({
                        kind: 'band-too-tall',
                        message: `Crosstab '${element.id}' needs ${(plan.headerHeightMm + plan.rowHeightMm).toFixed(1)}mm for a header and one row but the page body is ${this.bodyHeightMm.toFixed(1)}mm`,
                        detail: 'It will overflow the page rather than loop.',
                    });
                    slice = {
                        ...slice,
                        rowCount: 1,
                        heightMm: (withHeader ? plan.headerHeightMm : 0) + plan.rowHeightMm,
                    };
                }
                else {
                    this.finishPage();
                    this.startPage();
                    pagesBroken += 1;
                    tableTopMm = this.bodyTopMm();
                    withHeader = element.repeatHeader;
                    continue;
                }
            }
            this.drawCrosstab(plan, context, this.elementX(element), tableTopMm, slice);
            fromRow = slice.fromRow + slice.rowCount;
            if ((0, crosstab_1.crosstabIsComplete)(plan, slice)) {
                if (flow) {
                    this.finishFlowBandAfterTable(band, context, trailing, tableEndInBandMm, {
                        tableEndMm: tableTopMm + slice.heightMm,
                    });
                    return;
                }
                const tableBottomMm = tableTopMm + slice.heightMm + this.spacingMm(band);
                const bottomMm = pagesBroken === 0
                    ? Math.max(tableBottomMm, bandTopMm + this.bandHeight(band, context))
                    : tableBottomMm;
                this.cursorMm = Math.max(0, bottomMm - this.bodyTopMm());
                if (this.bandRequestsPageBreak(band, context)) {
                    this.finishPage();
                    this.startPage();
                }
                return;
            }
            this.finishPage();
            this.startPage();
            pagesBroken += 1;
            tableTopMm = this.bodyTopMm();
            withHeader = element.repeatHeader;
        }
    }
    finishFlowBandAfterTable(band, context, trailing, tableEndInBandMm, at) {
        const heightMm = this.bandHeight(band, context);
        let originMm = at.tableEndMm - tableEndInBandMm;
        const bodyBottomMm = this.bodyTopMm() + this.bodyHeightMm;
        const tailFits = originMm + heightMm <= bodyBottomMm + 0.001;
        if (trailing.length > 0 && !tailFits) {
            this.finishPage();
            this.startPage();
            originMm = this.bodyTopMm() - tableEndInBandMm;
        }
        this.drawBandElements(band, context, originMm, { placed: trailing });
        this.cursorMm = Math.max(0, originMm + heightMm - this.bodyTopMm());
        if (this.bandRequestsPageBreak(band, context)) {
            this.finishPage();
            this.startPage();
        }
    }
    fitsInRemainingBody(requiredMm) {
        if (this.bodyHeightMm === Number.POSITIVE_INFINITY) {
            return true;
        }
        return this.cursorMm + requiredMm <= this.bodyHeightMm + 0.001;
    }
    needsPageBreak(requiredMm) {
        if (!this.currentPage) {
            return false;
        }
        if (this.bodyHeightMm === Number.POSITIVE_INFINITY) {
            return false;
        }
        if (requiredMm > this.bodyHeightMm) {
            if (this.cursorMm === 0) {
                this.warnings.push({
                    kind: 'band-too-tall',
                    message: `A band is ${requiredMm.toFixed(1)}mm tall but the page body is only ${this.bodyHeightMm.toFixed(1)}mm`,
                    detail: 'It will overflow the page rather than loop.',
                });
                return false;
            }
            return true;
        }
        return this.cursorMm + requiredMm > this.bodyHeightMm + 0.001;
    }
    bandRequestsPageBreak(band, context) {
        for (const element of band.elements) {
            if (element.kind === 'PAGEBREAK' && this.evaluator.evaluateCondition(element.when, context)) {
                return true;
            }
        }
        return false;
    }
    bandHeight(band, context) {
        const declaredMm = this.definition.layoutMode === 'GRID' ? (band.heightRows ?? band.heightMm) : band.heightMm;
        const flow = this.flowLayoutFor(band, context);
        let crosstabMm = declaredMm;
        if (flow) {
            crosstabMm = flow.heightMm;
        }
        else {
            for (const element of band.elements) {
                if (element.kind !== 'CROSSTAB') {
                    continue;
                }
                if (!this.evaluator.evaluateCondition(element.visible, context)) {
                    continue;
                }
                const plan = this.crosstabPlanFor(element, context);
                crosstabMm = Math.max(crosstabMm, element.y + plan.fullHeightMm);
            }
        }
        if (!band.autoGrow) {
            return crosstabMm + this.spacingMm(band);
        }
        let neededMm = crosstabMm;
        for (const element of flow?.elements ?? band.elements) {
            if (!(0, template_definition_schema_1.isTextLike)(element) || !element.wrap) {
                continue;
            }
            if (!flow && !this.evaluator.evaluateCondition(element.visible, context)) {
                continue;
            }
            const text = this.evaluator.evaluateText(element.value, context);
            if (!text) {
                continue;
            }
            if (this.definition.layoutMode === 'GRID') {
                const columns = element.cols ?? element.w ?? 0;
                const lineCount = columns > 0 ? (0, text_1.wrapText)(text, columns).length : 1;
                neededMm = Math.max(neededMm, (element.row ?? 0) + lineCount);
                continue;
            }
            if (this.isSideways(element)) {
                continue;
            }
            neededMm = Math.max(neededMm, element.y + this.wrappedTextHeightMm(element, context, text));
        }
        return neededMm + this.spacingMm(band);
    }
    spacingMm(band) {
        if (band.spacingRows === 0) {
            return 0;
        }
        return this.definition.layoutMode === 'GRID'
            ? band.spacingRows
            : band.spacingRows *
                this.measurer.lineHeightMm({ family: 'NotoSans', sizePt: 9, bold: false, italic: false });
    }
    bodyTopMm() {
        return this.definition.layoutMode === 'GRID'
            ? this.pageHeaderHeightMm
            : this.paper.margins.top + this.pageHeaderHeightMm;
    }
    startPage() {
        if (this.pages.length >= MAX_PAGES) {
            this.warnings.push({
                kind: 'page-limit',
                message: `Render stopped at the ${MAX_PAGES}-page ceiling`,
            });
            return;
        }
        this.currentPage = { index: this.pages.length, primitives: [] };
        this.pages.push(this.currentPage);
        this.cursorMm = 0;
        this.pageAggregates.reset();
        const index = this.currentPage.index;
        this.numberingStarts[index] =
            index === 0 || this.restartNumberingOnNextPage
                ? index
                : (this.numberingStarts[index - 1] ?? 0);
        this.restartNumberingOnNextPage = false;
        const pageHeader = this.firstBand('PAGE_HEADER');
        if (pageHeader && this.shouldPrintOnPage(pageHeader, index)) {
            this.headerPrimitiveCounts[index] = this.drawBandElements(pageHeader, this.pageContext(index), this.definition.layoutMode === 'GRID' ? 0 : this.paper.margins.top, { stretchMm: this.stretchOf(pageHeader, this.pageHeaderHeightMm) });
            this.bandsEmitted += 1;
        }
    }
    finishPage() {
        if (!this.currentPage) {
            return;
        }
        const pageFooter = this.firstBand('PAGE_FOOTER');
        if (pageFooter && this.shouldPrintOnPage(pageFooter, this.currentPage.index)) {
            const footerTopMm = this.definition.layoutMode === 'GRID'
                ? this.pageHeaderHeightMm + this.bodyHeightMm
                : (this.paper.heightMm ?? 0) - this.paper.margins.bottom - this.pageFooterHeightMm;
            this.footerPrimitiveCounts[this.currentPage.index] = this.drawBandElements(pageFooter, this.pageContext(this.currentPage.index), footerTopMm, { stretchMm: this.stretchOf(pageFooter, this.pageFooterHeightMm) });
            this.bandsEmitted += 1;
        }
        this.currentPage = null;
    }
    drawPageBorders() {
        const border = this.definition.pageBorder;
        if (!border || this.definition.layoutMode === 'GRID' || this.paper.heightMm === null) {
            return;
        }
        const { widthMm, heightMm, margins } = this.paper;
        const left = border.insetMm ?? margins.left;
        const right = border.insetMm ?? margins.right;
        const top = border.insetMm ?? margins.top;
        const bottom = border.insetMm ?? margins.bottom;
        const w = widthMm - left - right;
        const h = heightMm - top - bottom;
        if (w <= 0 || h <= 0) {
            return;
        }
        const stroke = this.resolveColour(border.color, this.rootContext, '#000000');
        for (const page of this.pages) {
            page.primitives.unshift({
                k: 'rect',
                x: left,
                y: top,
                w,
                h,
                fill: null,
                stroke,
                strokeWidthPt: border.widthPt,
                radiusMm: border.radiusMm,
                ...(border.style && border.style !== 'SOLID' ? { dash: border.style } : {}),
            });
        }
    }
    drawWatermarks() {
        const watermark = this.definition.watermark;
        if (!watermark || this.definition.layoutMode === 'GRID' || this.paper.heightMm === null) {
            return;
        }
        const { widthMm, heightMm, margins } = this.paper;
        const x = margins.left;
        const y = margins.top;
        const w = widthMm - margins.left - margins.right;
        const h = heightMm - margins.top - margins.bottom;
        if (w <= 0 || h <= 0) {
            return;
        }
        const behind = [];
        const image = watermark.image
            ? this.evaluator.evaluateText(watermark.image, this.rootContext)
            : '';
        if (image) {
            const scale = watermark.imageScalePct / 100;
            const imageW = w * scale;
            const imageH = h * scale;
            behind.push({
                k: 'image',
                x: x + (w - imageW) / 2,
                y: y + (h - imageH) / 2,
                w: imageW,
                h: imageH,
                src: image,
                fit: 'CONTAIN',
                opacity: watermark.opacity,
            });
        }
        const text = watermark.text
            ? this.evaluator.evaluateText(watermark.text, this.rootContext)
            : '';
        if (text) {
            const font = {
                family: 'NotoSans',
                sizePt: watermark.fontSizePt,
                bold: watermark.bold,
                italic: false,
                underline: false,
            };
            behind.push({
                k: 'text',
                x,
                y,
                w,
                h,
                text,
                font,
                align: 'center',
                vAlign: 'middle',
                color: this.resolveColour(watermark.color, this.rootContext, '#808080'),
                lines: [text],
                lineHeightMm: this.measurer.lineHeightMm(this.measuredOf(font)),
                opacity: watermark.opacity,
                ...(watermark.rotationDeg ? { rotation: watermark.rotationDeg } : {}),
            });
        }
        if (behind.length === 0) {
            return;
        }
        for (const page of this.pages) {
            page.primitives.unshift(...behind);
        }
    }
    shouldPrintOnPage(band, pageIndex) {
        switch (band.printOn) {
            case 'FIRST_PAGE':
                return pageIndex === 0;
            case 'NOT_FIRST_PAGE':
                return pageIndex > 0;
            case 'LAST_PAGE':
            case 'NOT_LAST_PAGE':
            case 'ALL_PAGES':
            default:
                return true;
        }
    }
    drawBandElements(band, context, bandTopMm, options = {}) {
        if (!this.currentPage) {
            return 0;
        }
        const page = this.currentPage;
        const before = page.primitives.length;
        const { placed } = options;
        const stretchMm = options.stretchMm ?? 0;
        const ordered = [...(placed ?? band.elements)].sort((left, right) => left.z - right.z);
        for (const element of ordered) {
            if (element.kind === 'PAGEBREAK') {
                continue;
            }
            if (!placed && !this.evaluator.evaluateCondition(element.visible, context)) {
                continue;
            }
            if (element.kind === 'CROSSTAB') {
                if (element.id === options.skipCrosstabId) {
                    continue;
                }
                const plan = this.crosstabPlanFor(element, context);
                this.drawCrosstab(plan, context, this.elementX(element), bandTopMm + this.elementY(element), {
                    fromRow: 0,
                    rowCount: plan.model.rows.length,
                    withHeader: true,
                    withTotals: plan.totalsRowHeightMm > 0,
                    heightMm: plan.fullHeightMm,
                });
                continue;
            }
            if (element.kind === 'CHART') {
                this.drawChart(element, context, this.elementX(element), bandTopMm + this.elementY(element));
                this.drawFrame(element, context, bandTopMm, stretchMm);
                continue;
            }
            const look = (0, template_definition_schema_1.isTextLike)(element) ? this.textLook(element, context) : null;
            if (look?.fill && this.definition.layoutMode !== 'GRID') {
                page.primitives.push(this.backgroundOf(element, look.fill, bandTopMm, stretchMm));
            }
            for (const primitive of this.buildPrimitives(element, context, bandTopMm, stretchMm, look)) {
                page.primitives.push(primitive);
                if (primitive.k === 'text' && (0, template_definition_schema_1.isTextLike)(element) && this.dependsOnPage(element.value)) {
                    this.deferred.push({
                        pageIndex: page.index,
                        primitiveIndex: page.primitives.length - 1,
                        context,
                        rebuild: (pageContext) => this.buildTextElement(element, pageContext, bandTopMm, stretchMm, this.textLook(element, pageContext)),
                    });
                }
            }
            this.drawFrame(element, context, bandTopMm, stretchMm);
        }
        return page.primitives.length - before;
    }
    frameBox(element, bandTopMm, stretchMm) {
        const x = this.elementX(element);
        const y = bandTopMm + this.elementY(element);
        const grow = element.stretchWithBand ? stretchMm : 0;
        if (element.kind === 'QRCODE') {
            return { x, y, w: element.size, h: element.size + grow };
        }
        let h = element.h;
        if (h === undefined) {
            h = (0, template_definition_schema_1.isTextLike)(element) ? this.measurer.lineHeightMm(this.fontOf(element)) : 0;
        }
        return { x, y, w: element.w ?? 0, h: h + grow };
    }
    backgroundOf(element, fill, bandTopMm, stretchMm) {
        const box = this.frameBox(element, bandTopMm, stretchMm);
        return { k: 'rect', ...box, fill, stroke: null, strokeWidthPt: 0, radiusMm: 0 };
    }
    drawFrame(element, context, bandTopMm, stretchMm) {
        const border = element.border;
        if (!border ||
            !this.currentPage ||
            this.definition.layoutMode === 'GRID' ||
            element.kind === 'LINE' ||
            element.kind === 'PAGEBREAK' ||
            element.kind === 'CROSSTAB') {
            return;
        }
        if (!border.top && !border.right && !border.bottom && !border.left) {
            return;
        }
        const { x, y, w, h } = this.frameBox(element, bandTopMm, stretchMm);
        if (w <= 0 || h <= 0) {
            return;
        }
        const color = this.resolveColour(border.color, context, '#000000');
        const dash = border.style === 'SOLID' ? undefined : border.style;
        const primitives = this.currentPage.primitives;
        if (border.top && border.right && border.bottom && border.left) {
            primitives.push({
                k: 'rect',
                x,
                y,
                w,
                h,
                fill: null,
                stroke: color,
                strokeWidthPt: border.widthPt,
                radiusMm: 0,
                ...(dash ? { dash } : {}),
            });
            return;
        }
        const half = (border.widthPt * text_measure_1.MM_PER_POINT) / 2;
        const side = (x1, y1, x2, y2) => {
            primitives.push({
                k: 'line',
                x1,
                y1,
                x2,
                y2,
                widthPt: border.widthPt,
                color,
                gridChar: '-',
                ...(dash ? { dash } : {}),
            });
        };
        const leftReach = border.left ? half : 0;
        const rightReach = border.right ? half : 0;
        if (border.top) {
            side(x - leftReach, y, x + w + rightReach, y);
        }
        if (border.bottom) {
            side(x - leftReach, y + h, x + w + rightReach, y + h);
        }
        if (border.left) {
            side(x, y, x, y + h);
        }
        if (border.right) {
            side(x + w, y, x + w, y + h);
        }
    }
    drawChart(element, context, xMm, yMm) {
        if (!this.currentPage || this.definition.layoutMode === 'GRID') {
            return;
        }
        const rows = this.rowsOf(element.dataset);
        const built = (0, chart_1.buildChart)(element, rows, context, xMm, yMm, {
            measurer: this.measurer,
            evaluate: (template, rowContext) => this.evaluator.evaluate(template, rowContext),
            evaluateText: (template, rowContext) => this.evaluator.evaluateText(template, rowContext),
            resolveColour: (value, rowContext, fallback) => this.resolveColour(value, rowContext, fallback),
            rowContext: (row, index, total) => this.crosstabRowContext(context, row, index, total),
        });
        this.currentPage.primitives.push(...built.primitives);
        for (const message of built.warnings) {
            this.warnings.push({ kind: 'overflow', message });
        }
    }
    textLook(element, context) {
        let bold = element.font?.bold ?? false;
        let italic = element.font?.italic ?? false;
        let underline = element.font?.underline ?? false;
        let strikeout = element.font?.strikeout ?? false;
        let colour = element.style?.color;
        let fill = element.style?.fill;
        for (const rule of element.highlights ?? []) {
            if (!this.evaluator.evaluateCondition(rule.when, context)) {
                continue;
            }
            bold = rule.bold ?? bold;
            italic = rule.italic ?? italic;
            underline = rule.underline ?? underline;
            strikeout = rule.strikeout ?? strikeout;
            colour = rule.color ?? colour;
            fill = rule.fill ?? fill;
        }
        return {
            font: {
                family: element.font?.family ?? 'NotoSans',
                sizePt: element.font?.size ?? 9,
                bold,
                italic,
                underline,
                strikeout,
            },
            color: this.resolveColour(colour, context, '#000000'),
            fill: fill ? this.resolveColour(fill, context, '') || null : null,
        };
    }
    buildPrimitives(element, context, bandTopMm, stretchMm, look) {
        switch (element.kind) {
            case 'TEXT':
            case 'FIELD': {
                const primitive = this.buildTextElement(element, context, bandTopMm, stretchMm, look ?? this.textLook(element, context));
                return primitive ? [primitive] : [];
            }
            case 'LINE':
                return this.buildLine(element, context, bandTopMm);
            case 'RECT':
                return [this.buildShape(element, context, bandTopMm, stretchMm)];
            default: {
                const primitive = this.buildPrimitive(element, context, bandTopMm);
                return primitive ? [primitive] : [];
            }
        }
    }
    buildLine(element, context, bandTopMm) {
        const grid = this.definition.layoutMode === 'GRID';
        const color = this.resolveColour(element.style?.stroke, context, '#000000');
        const lineStyle = element.style?.lineStyle;
        const dash = !grid && lineStyle && lineStyle !== 'SOLID' ? lineStyle : undefined;
        const start = { x: element.x1, y: bandTopMm + element.y1 };
        const end = { x: element.x2, y: bandTopMm + element.y2 };
        const line = (from, to) => ({
            k: 'line',
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            widthPt: element.widthPt,
            color,
            gridChar: element.gridChar,
            ...(dash ? { dash } : {}),
        });
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        if (grid || length === 0 || (!element.arrowStart && !element.arrowEnd)) {
            return [line(start, end)];
        }
        const ux = (end.x - start.x) / length;
        const uy = (end.y - start.y) / length;
        const pull = Math.min(element.arrowSizeMm * 0.8, length / 2);
        const lineStart = element.arrowStart
            ? { x: start.x + ux * pull, y: start.y + uy * pull }
            : start;
        const lineEnd = element.arrowEnd ? { x: end.x - ux * pull, y: end.y - uy * pull } : end;
        const widthMm = element.widthPt * text_measure_1.MM_PER_POINT;
        const primitives = [line(lineStart, lineEnd)];
        if (element.arrowStart) {
            const head = (0, shapes_1.arrowHeadPath)(end, start, element.arrowSizeMm, widthMm, color);
            if (head) {
                primitives.push(head);
            }
        }
        if (element.arrowEnd) {
            const head = (0, shapes_1.arrowHeadPath)(start, end, element.arrowSizeMm, widthMm, color);
            if (head) {
                primitives.push(head);
            }
        }
        return primitives;
    }
    buildShape(element, context, bandTopMm, stretchMm) {
        const grid = this.definition.layoutMode === 'GRID';
        const style = element.style;
        const x = this.elementX(element);
        const y = bandTopMm + this.elementY(element);
        const w = element.w;
        const h = element.h + (element.stretchWithBand && !grid ? stretchMm : 0);
        const fill = style?.fill ? this.resolveColour(style.fill, context, '#000000') : null;
        const stroke = style?.stroke ? this.resolveColour(style.stroke, context, '#000000') : null;
        const strokeWidthPt = style?.strokeWidthPt ?? 0.5;
        const dash = !grid && style?.lineStyle && style.lineStyle !== 'SOLID' ? style.lineStyle : undefined;
        const shape = element.shape ?? 'RECT';
        if (grid || shape === 'RECT') {
            return {
                k: 'rect',
                x,
                y,
                w,
                h,
                fill,
                stroke,
                strokeWidthPt,
                radiusMm: element.radiusMm,
                ...(dash ? { dash } : {}),
            };
        }
        const pathStyle = { fill, stroke: stroke ?? (fill ? null : '#000000'), strokeWidthPt, dash };
        switch (shape) {
            case 'ELLIPSE':
                return (0, shapes_1.ellipsePath)(x, y, w, h, pathStyle);
            case 'TRIANGLE':
                return (0, shapes_1.trianglePath)(x, y, w, h, pathStyle);
            case 'RHOMBUS':
            default:
                return (0, shapes_1.rhombusPath)(x, y, w, h, pathStyle);
        }
    }
    buildTextElement(element, context, bandTopMm, stretchMm, look) {
        const x = this.elementX(element);
        const y = bandTopMm + this.elementY(element);
        const grow = element.stretchWithBand && this.definition.layoutMode !== 'GRID' ? stretchMm : 0;
        if (this.usesMarkup(element)) {
            if (this.definition.layoutMode === 'GRID') {
                const plain = this.markupRuns(element, context, look)
                    .map((run) => run.text)
                    .join('');
                if (this.isBlankZero(element, plain)) {
                    return null;
                }
                return this.buildTextPrimitive(element, plain, x, y, look, grow);
            }
            return this.buildRichTextPrimitive(element, context, x, y, look, grow);
        }
        const raw = this.resolveTextValue(element, context);
        if (raw === null) {
            return null;
        }
        return this.buildTextPrimitive(element, raw, x, y, look, grow);
    }
    usesMarkup(element) {
        return element.markup === true && !(element.kind === 'FIELD' && element.aggregate);
    }
    markupOf(template) {
        let segments = this.markupCache.get(template);
        if (!segments) {
            segments = (0, markup_1.parseMarkup)(template);
            this.markupCache.set(template, segments);
        }
        return segments;
    }
    markupRuns(element, context, look) {
        return this.markupOf(element.value).map((segment) => {
            const { style } = segment;
            const sizePt = (style.sizePt ?? look.font.sizePt) * (style.shift ? markup_1.SHIFT_SCALE : 1);
            return {
                text: this.evaluator.evaluateText(segment.template, context),
                font: {
                    family: look.font.family,
                    sizePt,
                    bold: style.bold ?? look.font.bold,
                    italic: style.italic ?? look.font.italic,
                    underline: style.underline ?? look.font.underline,
                    strikeout: style.strikeout ?? look.font.strikeout ?? false,
                },
                color: style.color ?? look.color,
                ...(style.shift ? { shift: style.shift } : {}),
            };
        });
    }
    isBlankZero(element, text) {
        if (!element.blankWhenZero) {
            return false;
        }
        const numeric = Number(text.replace(/[^0-9.-]/g, ''));
        return text.trim() === '' || (Number.isFinite(numeric) && numeric === 0);
    }
    isSideways(element) {
        return (this.definition.layoutMode !== 'GRID' && (element.rotation === 90 || element.rotation === 270));
    }
    buildRichTextPrimitive(element, context, x, y, look, grow) {
        const runs = this.markupRuns(element, context, look);
        const plain = runs.map((run) => run.text).join('');
        if (this.isBlankZero(element, plain)) {
            return null;
        }
        const box = this.textBox(element, x, y, grow);
        const wrapWidth = this.isSideways(element) ? box.sidewaysLengthMm : box.w;
        const layout = (0, markup_1.layoutRich)(runs, wrapWidth, element.wrap, this.measurer, this.measuredOf(look.font));
        const rotation = this.definition.layoutMode === 'GRID' ? 0 : (element.rotation ?? 0);
        return {
            k: 'text',
            x: box.x,
            y: box.y,
            w: box.w,
            h: box.h ?? layout.lines.length * layout.lineHeightMm + grow,
            text: layout.plain.join('\n'),
            font: look.font,
            align: element.align,
            vAlign: element.vAlign,
            color: look.color,
            lines: layout.plain,
            lineHeightMm: layout.lineHeightMm,
            rich: layout.lines,
            ...(rotation ? { rotation } : {}),
            ...(element.align === 'justify' ? { justify: layout.justify } : {}),
        };
    }
    measuredOf(font) {
        return { family: font.family, sizePt: font.sizePt, bold: font.bold, italic: font.italic };
    }
    textBox(element, x, y, grow) {
        const pad = this.definition.layoutMode === 'GRID' ? 0 : (element.style?.padding ?? 0);
        return {
            x: x + pad,
            y: y + pad,
            w: Math.max(0, (element.w ?? 0) - pad * 2),
            h: element.h === undefined ? undefined : Math.max(0, element.h + grow - pad * 2),
            pad,
            sidewaysLengthMm: Math.max(0, (element.h ?? 0) - pad * 2),
        };
    }
    wrappedTextHeightMm(element, context, text) {
        const look = this.textLook(element, context);
        const box = this.textBox(element, 0, 0, 0);
        if (this.usesMarkup(element)) {
            const layout = (0, markup_1.layoutRich)(this.markupRuns(element, context, look), box.w, true, this.measurer, this.measuredOf(look.font));
            return layout.lines.length * layout.lineHeightMm + box.pad * 2;
        }
        return this.measurer.wrap(text, box.w, this.measuredOf(look.font)).heightMm + box.pad * 2;
    }
    buildPrimitive(element, context, bandTopMm) {
        const baseX = this.elementX(element);
        const baseY = bandTopMm + this.elementY(element);
        switch (element.kind) {
            case 'IMAGE': {
                const src = this.evaluator.evaluateText(element.source, context);
                if (!src) {
                    return null;
                }
                return {
                    k: 'image',
                    x: baseX,
                    y: baseY,
                    w: element.w,
                    h: element.h,
                    src,
                    fit: element.fit,
                };
            }
            case 'BARCODE': {
                const value = this.evaluator.evaluateText(element.value, context);
                if (!value) {
                    return null;
                }
                return {
                    k: 'barcode',
                    x: baseX,
                    y: baseY,
                    w: element.w,
                    h: element.h,
                    symbology: element.symbology,
                    value,
                    showText: element.showText,
                };
            }
            case 'QRCODE': {
                const value = this.evaluator.evaluateText(element.value, context);
                if (!value) {
                    return null;
                }
                return {
                    k: 'qrcode',
                    x: baseX,
                    y: baseY,
                    size: element.size,
                    value,
                    errorCorrection: element.errorCorrection,
                };
            }
            default:
                return null;
        }
    }
    resolveTextValue(element, context) {
        if (element.kind === 'FIELD' && element.aggregate) {
            const total = this.readAggregate(element.id, element.aggregate.fn, element.aggregate.scope);
            if (element.blankWhenZero && total === 0) {
                return null;
            }
            return this.formatAggregate(element, total, context);
        }
        const text = this.evaluator.evaluateText(element.value, context);
        if (element.blankWhenZero) {
            const numeric = Number(text.replace(/[^0-9.-]/g, ''));
            if (text.trim() === '' || (Number.isFinite(numeric) && numeric === 0)) {
                return null;
            }
        }
        return text;
    }
    formatAggregate(element, total, context) {
        const aggregateContext = {
            ...context,
            agg: { ...context.agg, value: total },
            row: new Proxy({}, {
                get: () => total,
                has: () => true,
            }),
        };
        return this.evaluator.evaluateText(element.value, aggregateContext);
    }
    readAggregate(elementId, fn, scope) {
        switch (scope) {
            case 'REPORT':
                return this.precomputed.readReport(elementId, fn);
            case 'PAGE':
                return this.pageAggregates.read(elementId, fn);
            case 'GROUP': {
                const innermost = this.openGroups[this.openGroups.length - 1];
                return innermost ? this.precomputed.readGroup(innermost.path, elementId, fn) : 0;
            }
            default:
                return 0;
        }
    }
    buildTextPrimitive(element, text, x, y, look, grow = 0) {
        const font = this.measuredOf(look.font);
        const grid = this.definition.layoutMode === 'GRID';
        const box = this.textBox(element, x, y, grow);
        const widthMm = grid ? (element.w ?? 0) : box.w;
        const lineLengthMm = this.isSideways(element) ? box.sidewaysLengthMm : widthMm;
        const justified = element.align === 'justify' && this.definition.layoutMode !== 'GRID';
        let lines;
        let lineHeightMm;
        let justify;
        if (this.definition.layoutMode === 'GRID') {
            const columns = element.cols ?? element.w ?? 0;
            lineHeightMm = 1;
            lines = element.wrap && columns > 0 ? (0, text_1.wrapText)(text, columns) : [text];
            if (lines.length === 0) {
                lines = [''];
            }
        }
        else if (element.wrap && lineLengthMm > 0) {
            lineHeightMm = this.measurer.lineHeightMm(font);
            lines = [];
            justify = [];
            for (const paragraph of text.split(/\r?\n/)) {
                const wrapped = paragraph.trim()
                    ? [...this.measurer.wrap(paragraph, lineLengthMm, font).lines]
                    : [''];
                wrapped.forEach((line, index) => {
                    lines.push(line);
                    justify?.push(index < wrapped.length - 1);
                });
            }
        }
        else {
            lineHeightMm = this.measurer.lineHeightMm(font);
            lines = [
                element.ellipsis && lineLengthMm > 0
                    ? this.measurer.truncateToWidth(text, lineLengthMm, font)
                    : text,
            ];
        }
        const rotation = this.definition.layoutMode === 'GRID' ? 0 : (element.rotation ?? 0);
        return {
            k: 'text',
            x: box.x,
            y: box.y,
            w: widthMm,
            h: box.h ?? lines.length * lineHeightMm + grow,
            text: lines.join('\n'),
            font: look.font,
            align: element.align,
            vAlign: element.vAlign,
            color: look.color,
            lines,
            lineHeightMm,
            ...(rotation ? { rotation } : {}),
            ...(justified && justify ? { justify } : {}),
        };
    }
    elementX(element) {
        return this.definition.layoutMode === 'GRID' ? (element.col ?? 0) : element.x;
    }
    elementY(element) {
        return this.definition.layoutMode === 'GRID' ? (element.row ?? 0) : element.y;
    }
    fontOf(element) {
        return {
            family: element.font?.family ?? 'NotoSans',
            sizePt: element.font?.size ?? 9,
            bold: element.font?.bold ?? false,
            italic: element.font?.italic ?? false,
        };
    }
    resolveColour(value, context, fallback) {
        if (!value) {
            return fallback;
        }
        if (!value.includes('{{')) {
            return value;
        }
        const resolved = this.evaluator.evaluateText(value, context);
        return /^#[0-9a-fA-F]{6}$/.test(resolved) ? resolved : fallback;
    }
    dependsOnPage(template) {
        return template.includes('{{') && /\bpage\s*\./.test(template);
    }
    resolveDeferredText() {
        const total = this.pages.length;
        const runEnds = new Map();
        for (const page of this.pages) {
            const start = this.numberingStarts[page.index] ?? 0;
            runEnds.set(start, Math.max(runEnds.get(start) ?? start, page.index));
        }
        for (const entry of this.deferred) {
            const page = this.pages[entry.pageIndex];
            if (!page) {
                continue;
            }
            const existing = page.primitives[entry.primitiveIndex];
            if (!existing || existing.k !== 'text') {
                continue;
            }
            const start = this.numberingStarts[entry.pageIndex] ?? 0;
            const end = runEnds.get(start) ?? total - 1;
            const context = {
                ...entry.context,
                page: {
                    number: entry.pageIndex - start + 1,
                    total: end - start + 1,
                    isFirst: entry.pageIndex === start,
                    isLast: entry.pageIndex === end,
                },
            };
            page.primitives[entry.primitiveIndex] = entry.rebuild(context) ?? {
                ...existing,
                text: '',
                lines: [''],
                rich: undefined,
            };
        }
        this.suppressLastPageBands(total);
    }
    suppressLastPageBands(total) {
        const pageHeader = this.firstBand('PAGE_HEADER');
        const pageFooter = this.firstBand('PAGE_FOOTER');
        const suppressionNeeded = (band, pageIndex) => {
            if (!band) {
                return false;
            }
            const isLast = pageIndex === total - 1;
            return ((band.printOn === 'LAST_PAGE' && !isLast) || (band.printOn === 'NOT_LAST_PAGE' && isLast));
        };
        for (const page of this.pages) {
            if (suppressionNeeded(pageFooter, page.index)) {
                const count = this.footerPrimitiveCounts[page.index] ?? 0;
                if (count > 0) {
                    page.primitives.splice(page.primitives.length - count, count);
                }
            }
            if (suppressionNeeded(pageHeader, page.index)) {
                const count = this.headerPrimitiveCounts[page.index] ?? 0;
                if (count > 0) {
                    page.primitives.splice(0, count);
                }
            }
        }
    }
    rowContext(row, index, totalRows, keys) {
        const innermost = keys.length > 0 ? keys[keys.length - 1] : '';
        return {
            ...this.rootContext,
            row: this.rowValue(row, index, totalRows),
            group: {
                key: innermost,
                level: Math.max(0, keys.length - 1),
                count: this.openGroups[this.openGroups.length - 1]?.rowCount ?? 0,
                keys: [...keys],
            },
            page: this.currentPageDescriptor(),
        };
    }
    groupContext(open) {
        return {
            ...this.rootContext,
            group: {
                key: open.key,
                level: open.level,
                count: open.rowCount,
                keys: open.path.split(aggregate_accumulator_1.GROUP_PATH_SEPARATOR),
            },
            page: this.currentPageDescriptor(),
        };
    }
    pageContext(pageIndex) {
        const start = this.numberingStarts[pageIndex] ?? 0;
        return {
            ...this.rootContext,
            page: {
                number: pageIndex - start + 1,
                total: this.pages.length - start,
                isFirst: pageIndex === start,
                isLast: false,
            },
        };
    }
    currentPageDescriptor() {
        const index = this.currentPage?.index ?? 0;
        return { number: index + 1, total: this.pages.length, isFirst: index === 0, isLast: false };
    }
    rowValue(row, index, totalRows) {
        const base = row && typeof row === 'object' ? row : { value: row };
        return {
            ...base,
            __index: base.__index ?? index + 1,
            __zeroIndex: index,
            __count: totalRows,
            __isFirst: index === 0,
            __isLast: index === totalRows - 1,
            __isEven: index % 2 === 1,
        };
    }
    firstBand(type) {
        return this.bandsByType.get(type)?.[0];
    }
    bandsByLevel(type, dataset) {
        const bands = (this.bandsByType.get(type) ?? []).filter((band) => band.dataset === dataset);
        const byLevel = [];
        for (const band of bands) {
            byLevel[band.groupLevel] = band;
        }
        return byLevel.filter((band) => band !== undefined);
    }
    rowsOf(datasetName) {
        const value = this.rootContext[datasetName];
        if (Array.isArray(value)) {
            return value;
        }
        if (value === null || value === undefined) {
            this.warnings.push({
                kind: 'missing-dataset',
                message: `Dataset '${datasetName}' resolved to nothing`,
            });
            return [];
        }
        return [value];
    }
}
//# sourceMappingURL=layout.engine.js.map