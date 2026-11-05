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
exports.TILL_PRINT_PROVIDERS = exports.TillRemitLinesProvider = exports.TillRemitHeaderProvider = exports.TillMovementLinesProvider = exports.TillMovementHeaderProvider = exports.TillDayTendersProvider = exports.TillDaySessionsProvider = exports.TillDayHeaderProvider = exports.TillSessionMovementsProvider = exports.TillSessionTendersProvider = exports.TillSessionHeaderProvider = void 0;
const common_1 = require("@nestjs/common");
const till_print_service_1 = require("../../../../till/services/till-print.service");
const provider_utils_1 = require("./provider.utils");
function docOf(request, code) {
    const { docId, accYear } = (0, provider_utils_1.requireDocument)(request, code);
    return {
        companyId: request.context.companyId,
        docId,
        accYear,
        userId: request.context.userId,
    };
}
let TillSessionHeaderProvider = class TillSessionHeaderProvider {
    till;
    code = 'till.session.header';
    label = 'Till session — header (Z / X)';
    cardinality = 'one';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return this.till.sessionHeader(docOf(request, this.code));
    }
};
exports.TillSessionHeaderProvider = TillSessionHeaderProvider;
exports.TillSessionHeaderProvider = TillSessionHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillSessionHeaderProvider);
let TillSessionTendersProvider = class TillSessionTendersProvider {
    till;
    code = 'till.session.tenders';
    label = 'Till session — tenders';
    cardinality = 'many';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return (await this.till.sessionTenders(docOf(request, this.code))).slice(0, request.rowLimit);
    }
};
exports.TillSessionTendersProvider = TillSessionTendersProvider;
exports.TillSessionTendersProvider = TillSessionTendersProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillSessionTendersProvider);
let TillSessionMovementsProvider = class TillSessionMovementsProvider {
    till;
    code = 'till.session.movements';
    label = 'Till session — movements';
    cardinality = 'many';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return (await this.till.sessionMovements(docOf(request, this.code))).slice(0, request.rowLimit);
    }
};
exports.TillSessionMovementsProvider = TillSessionMovementsProvider;
exports.TillSessionMovementsProvider = TillSessionMovementsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillSessionMovementsProvider);
let TillDayHeaderProvider = class TillDayHeaderProvider {
    till;
    code = 'till.day.header';
    label = 'Business day — header (day X / store Z)';
    cardinality = 'one';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return this.till.dayHeader(docOf(request, this.code));
    }
};
exports.TillDayHeaderProvider = TillDayHeaderProvider;
exports.TillDayHeaderProvider = TillDayHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillDayHeaderProvider);
let TillDaySessionsProvider = class TillDaySessionsProvider {
    till;
    code = 'till.day.sessions';
    label = 'Business day — sessions';
    cardinality = 'many';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return (await this.till.daySessions(docOf(request, this.code))).slice(0, request.rowLimit);
    }
};
exports.TillDaySessionsProvider = TillDaySessionsProvider;
exports.TillDaySessionsProvider = TillDaySessionsProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillDaySessionsProvider);
let TillDayTendersProvider = class TillDayTendersProvider {
    till;
    code = 'till.day.tenders';
    label = 'Business day — tenders';
    cardinality = 'many';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return (await this.till.dayTenders(docOf(request, this.code))).slice(0, request.rowLimit);
    }
};
exports.TillDayTendersProvider = TillDayTendersProvider;
exports.TillDayTendersProvider = TillDayTendersProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillDayTendersProvider);
let TillMovementHeaderProvider = class TillMovementHeaderProvider {
    till;
    code = 'till.movement.header';
    label = 'Till movement — slip header';
    cardinality = 'one';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return this.till.movementHeader(docOf(request, this.code));
    }
};
exports.TillMovementHeaderProvider = TillMovementHeaderProvider;
exports.TillMovementHeaderProvider = TillMovementHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillMovementHeaderProvider);
let TillMovementLinesProvider = class TillMovementLinesProvider {
    till;
    code = 'till.movement.lines';
    label = 'Till movement — denominations';
    cardinality = 'many';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return (await this.till.movementLines(docOf(request, this.code))).slice(0, request.rowLimit);
    }
};
exports.TillMovementLinesProvider = TillMovementLinesProvider;
exports.TillMovementLinesProvider = TillMovementLinesProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillMovementLinesProvider);
let TillRemitHeaderProvider = class TillRemitHeaderProvider {
    till;
    code = 'till.remit.header';
    label = 'Till remittance — memo header';
    cardinality = 'one';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return this.till.remitHeader(docOf(request, this.code));
    }
};
exports.TillRemitHeaderProvider = TillRemitHeaderProvider;
exports.TillRemitHeaderProvider = TillRemitHeaderProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillRemitHeaderProvider);
let TillRemitLinesProvider = class TillRemitLinesProvider {
    till;
    code = 'till.remit.lines';
    label = 'Till remittance — denominations';
    cardinality = 'many';
    constructor(till) {
        this.till = till;
    }
    async resolve(request) {
        return (await this.till.remitLines(docOf(request, this.code))).slice(0, request.rowLimit);
    }
};
exports.TillRemitLinesProvider = TillRemitLinesProvider;
exports.TillRemitLinesProvider = TillRemitLinesProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [till_print_service_1.TillPrintService])
], TillRemitLinesProvider);
exports.TILL_PRINT_PROVIDERS = [
    TillSessionHeaderProvider,
    TillSessionTendersProvider,
    TillSessionMovementsProvider,
    TillDayHeaderProvider,
    TillDaySessionsProvider,
    TillDayTendersProvider,
    TillMovementHeaderProvider,
    TillMovementLinesProvider,
    TillRemitHeaderProvider,
    TillRemitLinesProvider,
];
//# sourceMappingURL=till.providers.js.map