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
var ReportDataProviderRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDataProviderRegistry = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const report_data_provider_decorator_1 = require("./report-data-provider.decorator");
const dynamic_dataset_source_1 = require("./dynamic/dynamic-dataset.source");
let ReportDataProviderRegistry = ReportDataProviderRegistry_1 = class ReportDataProviderRegistry {
    discovery;
    reflector;
    dynamic;
    logger = new common_1.Logger(ReportDataProviderRegistry_1.name);
    providers = new Map();
    descriptors = new Map();
    constructor(discovery, reflector, dynamic) {
        this.discovery = discovery;
        this.reflector = reflector;
        this.dynamic = dynamic;
    }
    onModuleInit() {
        for (const wrapper of this.discovery.getProviders()) {
            const instance = wrapper.instance;
            const metatype = wrapper.metatype;
            if (!instance || typeof instance !== 'object' || !metatype) {
                continue;
            }
            const metadata = this.reflector.get(report_data_provider_decorator_1.REPORT_DATA_PROVIDER_METADATA, metatype);
            if (!metadata) {
                continue;
            }
            const candidate = instance;
            if (typeof candidate.resolve !== 'function' ||
                typeof candidate.sampleData !== 'function' ||
                typeof candidate.fields !== 'function') {
                this.logger.error(`Provider '${metadata.token}' (${metatype.name}) is decorated but does not implement IReportDataProvider`);
                continue;
            }
            if (this.providers.has(metadata.token)) {
                this.logger.error(`Duplicate report dataset token '${metadata.token}' — ${metatype.name} is shadowing an earlier provider`);
                continue;
            }
            const provider = instance;
            this.providers.set(metadata.token, provider);
            this.descriptors.set(metadata.token, {
                token: metadata.token,
                label: metadata.label ?? metadata.token,
                cardinality: metadata.cardinality ?? 'many',
                docTypes: metadata.docTypes ?? [],
                fields: provider.fields(),
            });
        }
        this.logger.log(`Registered ${this.providers.size} report data provider(s)`);
    }
    has(token) {
        return this.providers.has(token) || this.dynamic.has(token);
    }
    get(token) {
        const provider = this.providers.get(token) ?? this.dynamic.get(token);
        if (!provider) {
            throw new common_1.NotFoundException(`Unknown report dataset provider '${token}'. Registered: ${this.listTokens().join(', ')}`);
        }
        return provider;
    }
    list(docType) {
        const all = [...this.descriptors.values(), ...this.dynamic.list()];
        const filtered = docType === undefined
            ? all
            : all.filter((descriptor) => descriptor.docTypes.length === 0 || descriptor.docTypes.includes(docType));
        return filtered.sort((left, right) => left.token.localeCompare(right.token));
    }
    listTokens() {
        return [...this.providers.keys(), ...this.dynamic.listTokens()].sort();
    }
    async resolve(token, context) {
        return this.get(token).resolve(context);
    }
    sample(token) {
        return this.get(token).sampleData();
    }
};
exports.ReportDataProviderRegistry = ReportDataProviderRegistry;
exports.ReportDataProviderRegistry = ReportDataProviderRegistry = ReportDataProviderRegistry_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.DiscoveryService,
        core_1.Reflector,
        dynamic_dataset_source_1.DynamicDatasetSource])
], ReportDataProviderRegistry);
//# sourceMappingURL=report-data-provider.registry.js.map