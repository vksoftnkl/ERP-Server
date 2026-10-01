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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PrintDataProviderRegistry_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintDataProviderRegistry = exports.PRINT_DATA_PROVIDERS = void 0;
const common_1 = require("@nestjs/common");
exports.PRINT_DATA_PROVIDERS = Symbol('PRINT_DATA_PROVIDERS');
let PrintDataProviderRegistry = PrintDataProviderRegistry_1 = class PrintDataProviderRegistry {
    logger = new common_1.Logger(PrintDataProviderRegistry_1.name);
    byCode = new Map();
    constructor(providers) {
        for (const provider of providers) {
            const key = provider.code.toLowerCase();
            const existing = this.byCode.get(key);
            if (existing) {
                throw new Error(`Duplicate print data provider code '${provider.code}': ` +
                    `${existing.constructor.name} and ${provider.constructor.name}`);
            }
            this.byCode.set(key, provider);
        }
        this.logger.log(`Registered ${this.byCode.size} print data provider(s): ${[...this.byCode.keys()].sort().join(', ')}`);
    }
    has(code) {
        return this.byCode.has(code.trim().toLowerCase());
    }
    get(code) {
        return this.byCode.get(code.trim().toLowerCase());
    }
    codes() {
        return [...this.byCode.keys()].sort();
    }
    describe() {
        return [...this.byCode.values()]
            .map((provider) => ({
            code: provider.code,
            label: provider.label,
            cardinality: provider.cardinality,
        }))
            .sort((left, right) => left.code.localeCompare(right.code));
    }
};
exports.PrintDataProviderRegistry = PrintDataProviderRegistry;
exports.PrintDataProviderRegistry = PrintDataProviderRegistry = PrintDataProviderRegistry_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.PRINT_DATA_PROVIDERS)),
    __metadata("design:paramtypes", [Array])
], PrintDataProviderRegistry);
//# sourceMappingURL=print-data-provider.registry.js.map