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
exports.TransactionService = void 0;
const common_1 = require("@nestjs/common");
const open_items_service_1 = require("../receipt/open-items.service");
const transaction_api_types_1 = require("./types/transaction-api.types");
let TransactionService = class TransactionService {
    openItemsService;
    constructor(openItemsService) {
        this.openItemsService = openItemsService;
    }
    async getPartyAdjustableCredits(query) {
        const side = query.type ?? transaction_api_types_1.DEFAULT_ADJUSTABLE_CREDIT_SIDE;
        const credits = await this.openItemsService.loadCredits(query.companyId, query.partyId, side);
        return credits
            .filter((credit) => Object.values(transaction_api_types_1.AdjustableCreditBillType).includes(credit.billType))
            .map((credit) => {
            const billType = credit.billType;
            const routing = transaction_api_types_1.CREDIT_ADJUSTMENT_ROUTING[billType];
            return {
                billId: credit.billId,
                billAccYear: credit.billAccYear,
                billType,
                docRefno: credit.docRefno,
                docDate: credit.docDate,
                billAmount: credit.billAmount,
                pendingAmount: credit.pendingAmount,
                status: credit.status,
                drCr: credit.drCr,
                srcModule: credit.srcModule,
                srcDocType: credit.srcDocType,
                srcDocId: credit.srcDocId,
                srcAccYear: credit.srcAccYear,
                narration: credit.narration,
                adjType: routing.adjType,
                settlementMode: routing.settlementMode,
            };
        });
    }
};
exports.TransactionService = TransactionService;
exports.TransactionService = TransactionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [open_items_service_1.OpenItemsService])
], TransactionService);
//# sourceMappingURL=transaction.service.js.map