"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockTrackPresetsModule = void 0;
const common_1 = require("@nestjs/common");
const stock_track_presets_controller_1 = require("./stock-track-presets.controller");
const stock_track_presets_service_1 = require("./stock-track-presets.service");
let StockTrackPresetsModule = class StockTrackPresetsModule {
};
exports.StockTrackPresetsModule = StockTrackPresetsModule;
exports.StockTrackPresetsModule = StockTrackPresetsModule = __decorate([
    (0, common_1.Module)({
        controllers: [stock_track_presets_controller_1.StockTrackPresetsController],
        providers: [stock_track_presets_service_1.StockTrackPresetsService],
        exports: [stock_track_presets_service_1.StockTrackPresetsService],
    })
], StockTrackPresetsModule);
//# sourceMappingURL=stock-track-presets.module.js.map