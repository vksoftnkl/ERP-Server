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
const aggregate_accumulator_1 = require("./aggregate.accumulator");
const text_measure_1 = require("./text-measure");
const MAX_PAGES = 2_000;
const MAX_DETAIL_ROWS = 100_000;
let LayoutEngine = class LayoutEngine {
    measurer;
    constructor(measurer) {
        this.measurer = measurer;
    }
    render(input) {
        const startedAt = Date.now();
        return new LayoutRun(this.measurer, input).run(startedAt);
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
        const heightMm = this.bandHeight(band, context);
        const reserveMm = options.reserveMm ?? 0;
        if (this.needsPageBreak(heightMm + reserveMm)) {
            this.finishPage();
            this.startPage();
        }
        const bandTopMm = this.bodyTopMm() + this.cursorMm;
        this.drawBandElements(band, context, bandTopMm);
        this.cursorMm += heightMm;
        this.bandsEmitted += 1;
        if (this.bandRequestsPageBreak(band, context)) {
            this.finishPage();
            this.startPage();
        }
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
        if (!band.autoGrow) {
            return declaredMm + this.spacingMm(band);
        }
        let neededMm = declaredMm;
        for (const element of band.elements) {
            if (!(0, template_definition_schema_1.isTextLike)(element) || !element.wrap) {
                continue;
            }
            if (!this.evaluator.evaluateCondition(element.visible, context)) {
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
            const font = this.fontOf(element);
            const wrapped = this.measurer.wrap(text, element.w ?? 0, font);
            neededMm = Math.max(neededMm, element.y + wrapped.heightMm);
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
        const pageHeader = this.firstBand('PAGE_HEADER');
        if (pageHeader && this.shouldPrintOnPage(pageHeader, this.currentPage.index)) {
            this.drawBandElements(pageHeader, this.pageContext(this.currentPage.index), this.definition.layoutMode === 'GRID' ? 0 : this.paper.margins.top);
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
            this.drawBandElements(pageFooter, this.pageContext(this.currentPage.index), footerTopMm);
            this.bandsEmitted += 1;
        }
        this.currentPage = null;
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
    drawBandElements(band, context, bandTopMm) {
        if (!this.currentPage) {
            return;
        }
        const page = this.currentPage;
        const ordered = [...band.elements].sort((left, right) => left.z - right.z);
        for (const element of ordered) {
            if (element.kind === 'PAGEBREAK') {
                continue;
            }
            if (!this.evaluator.evaluateCondition(element.visible, context)) {
                continue;
            }
            const primitive = this.buildPrimitive(element, context, bandTopMm);
            if (!primitive) {
                continue;
            }
            page.primitives.push(primitive);
            if (primitive.k === 'text' && (0, template_definition_schema_1.isTextLike)(element) && this.dependsOnPage(element.value)) {
                this.deferred.push({
                    pageIndex: page.index,
                    primitiveIndex: page.primitives.length - 1,
                    template: element.value,
                    context,
                    maxWidthMm: element.w ?? 0,
                    wrap: element.wrap,
                    font: this.fontOf(element),
                });
            }
        }
    }
    buildPrimitive(element, context, bandTopMm) {
        const baseX = this.elementX(element);
        const baseY = bandTopMm + this.elementY(element);
        switch (element.kind) {
            case 'TEXT':
            case 'FIELD': {
                const raw = this.resolveTextValue(element, context);
                if (raw === null) {
                    return null;
                }
                return this.buildTextPrimitive(element, raw, baseX, baseY);
            }
            case 'LINE': {
                const style = element.style;
                return {
                    k: 'line',
                    x1: element.x1,
                    y1: bandTopMm + element.y1,
                    x2: element.x2,
                    y2: bandTopMm + element.y2,
                    widthPt: element.widthPt,
                    color: this.resolveColour(style?.stroke, context, '#000000'),
                    gridChar: element.gridChar,
                };
            }
            case 'RECT': {
                const style = element.style;
                return {
                    k: 'rect',
                    x: baseX,
                    y: baseY,
                    w: element.w,
                    h: element.h,
                    fill: style?.fill ? this.resolveColour(style.fill, context, '#000000') : null,
                    stroke: style?.stroke ? this.resolveColour(style.stroke, context, '#000000') : null,
                    strokeWidthPt: style?.strokeWidthPt ?? 0.5,
                    radiusMm: element.radiusMm,
                };
            }
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
    buildTextPrimitive(element, text, x, y) {
        const font = this.fontOf(element);
        const widthMm = element.w ?? 0;
        let lines;
        let lineHeightMm;
        if (this.definition.layoutMode === 'GRID') {
            const columns = element.cols ?? element.w ?? 0;
            lineHeightMm = 1;
            lines = element.wrap && columns > 0 ? (0, text_1.wrapText)(text, columns) : [text];
            if (lines.length === 0) {
                lines = [''];
            }
        }
        else if (element.wrap && widthMm > 0) {
            const wrapped = this.measurer.wrap(text, widthMm, font);
            lines = [...wrapped.lines];
            lineHeightMm = wrapped.lineHeightMm;
        }
        else {
            lineHeightMm = this.measurer.lineHeightMm(font);
            lines = [
                element.ellipsis && widthMm > 0 ? this.measurer.truncateToWidth(text, widthMm, font) : text,
            ];
        }
        return {
            k: 'text',
            x,
            y,
            w: widthMm,
            h: element.h ?? lines.length * lineHeightMm,
            text: lines.join('\n'),
            font: {
                family: font.family,
                sizePt: font.sizePt,
                bold: font.bold,
                italic: font.italic,
                underline: element.font?.underline ?? false,
            },
            align: element.align,
            vAlign: element.vAlign,
            color: this.resolveColour(element.style?.color, this.rootContext, '#000000'),
            lines,
            lineHeightMm,
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
        for (const entry of this.deferred) {
            const page = this.pages[entry.pageIndex];
            if (!page) {
                continue;
            }
            const existing = page.primitives[entry.primitiveIndex];
            if (!existing || existing.k !== 'text') {
                continue;
            }
            const context = {
                ...entry.context,
                page: {
                    number: entry.pageIndex + 1,
                    total,
                    isFirst: entry.pageIndex === 0,
                    isLast: entry.pageIndex === total - 1,
                },
            };
            const text = this.evaluator.evaluateText(entry.template, context);
            const lines = entry.wrap && entry.maxWidthMm > 0
                ? [...this.measurer.wrap(text, entry.maxWidthMm, entry.font).lines]
                : [text];
            page.primitives[entry.primitiveIndex] = { ...existing, text: lines.join('\n'), lines };
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
                const count = this.visibleElementCount(pageFooter);
                page.primitives.splice(page.primitives.length - count, count);
            }
            if (suppressionNeeded(pageHeader, page.index)) {
                const count = this.visibleElementCount(pageHeader);
                page.primitives.splice(0, count);
            }
        }
    }
    visibleElementCount(band) {
        let count = 0;
        for (const element of band.elements) {
            if (element.kind === 'PAGEBREAK') {
                continue;
            }
            if (element.visible) {
                this.warnings.push({
                    kind: 'overflow',
                    message: `A ${band.printOn} band has an element with a 'visible' condition, ` +
                        'which cannot be combined with last-page suppression',
                    detail: `element ${element.id}`,
                });
            }
            count += 1;
        }
        return count;
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
        return {
            ...this.rootContext,
            page: {
                number: pageIndex + 1,
                total: this.pages.length,
                isFirst: pageIndex === 0,
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