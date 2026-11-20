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
var WaAfterPostService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WaAfterPostService = void 0;
const common_1 = require("@nestjs/common");
const wa_post_hook_1 = require("./hook/wa-post-hook");
const wa_send_service_1 = require("./wa-send.service");
const wa_settings_service_1 = require("./wa-settings.service");
const wa_store_service_1 = require("./wa-store.service");
let WaAfterPostService = WaAfterPostService_1 = class WaAfterPostService {
    hook;
    store;
    sends;
    settings;
    logger = new common_1.Logger(WaAfterPostService_1.name);
    constructor(hook, store, sends, settings) {
        this.hook = hook;
        this.store = store;
        this.sends = sends;
        this.settings = settings;
    }
    onModuleInit() {
        this.hook.register((event) => this.onPost(event));
    }
    async onPost(event) {
        if (event.waOnPost === false)
            return null;
        if (event.waOnPost !== true && !(await this.ticked(event.companyId, event.vchrTypeId)))
            return null;
        const actor = await this.store.actor();
        const prepared = await this.sends.prepareDocument({
            companyId: event.companyId,
            docType: event.docType,
            docId: event.docId,
            docAccYear: event.accYear,
            trigger: 'ON_POST',
            actor,
        });
        if ('notConnected' in prepared) {
            return { wmlId: null, accYear: null, status: 'NOT_CONNECTED', fallbackClickToChat: prepared.fallbackClickToChat };
        }
        if (prepared.status === 'SENDING') {
            setImmediate(() => {
                this.sends.deliver(prepared).catch((e) => this.logger.error(`on-post send ${prepared.wmlId}: ${String(e)}`));
            });
        }
        return {
            wmlId: prepared.wmlId,
            accYear: prepared.accYear,
            status: prepared.status === 'SENDING' ? 'SENDING' : prepared.status === 'FAILED' ? 'FAILED' : 'SKIPPED',
            errorCode: prepared.errorCode,
        };
    }
    async ticked(companyId, vchrTypeId) {
        if (vchrTypeId === null)
            return false;
        return (await this.settings.onPostSetting(companyId)).ids.includes(vchrTypeId);
    }
};
exports.WaAfterPostService = WaAfterPostService;
exports.WaAfterPostService = WaAfterPostService = WaAfterPostService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [wa_post_hook_1.WaPostHook,
        wa_store_service_1.WaStore,
        wa_send_service_1.WaSendService,
        wa_settings_service_1.WaSettingsService])
], WaAfterPostService);
//# sourceMappingURL=wa-after-post.service.js.map