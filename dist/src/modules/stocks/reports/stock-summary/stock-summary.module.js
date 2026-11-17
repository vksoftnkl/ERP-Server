"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockSummaryModule = void 0;
const common_1 = require("@nestjs/common");
const stock_summary_controller_1 = require("./stock-summary.controller");
const stock_summary_run_store_1 = require("./stock-summary-run.store");
const stock_summary_service_1 = require("./stock-summary.service");
let StockSummaryModule = class StockSummaryModule {
};
exports.StockSummaryModule = StockSummaryModule;
exports.StockSummaryModule = StockSummaryModule = __decorate([
    (0, common_1.Module)({
        controllers: [stock_summary_controller_1.StockSummaryController],
        providers: [stock_summary_service_1.StockSummaryService, stock_summary_run_store_1.StockSummaryRunStore],
        exports: [stock_summary_service_1.StockSummaryService],
    })
], StockSummaryModule);
//# sourceMappingURL=stock-summary.module.js.map