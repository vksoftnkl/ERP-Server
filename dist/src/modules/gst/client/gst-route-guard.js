"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.placeholdersOf = placeholdersOf;
exports.gstRouteRefusal = gstRouteRefusal;
exports.assertGstRouteActive = assertGstRouteActive;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const gst_config_constants_1 = require("../config/gst-config.constants");
const ACCOUNT_PLACEHOLDERS = ['aspId', 'aspPassword', 'apiKey'];
function placeholdersOf(endpoint) {
    const headers = endpoint.gpeHeaders;
    const texts = [
        endpoint.gpePathTemplate,
        endpoint.gpeQueryTemplate ?? '',
        ...(headers && typeof headers === 'object' && !Array.isArray(headers)
            ? Object.values(headers).map((v) => (typeof v === 'string' ? v : ''))
            : []),
    ];
    const names = new Set();
    for (const text of texts) {
        for (const match of text.matchAll(/\{(\w+)\}/g)) {
            names.add(match[1]);
        }
    }
    return names;
}
function needsAccount(route) {
    if (!route.endpoint) {
        return false;
    }
    const uses = placeholdersOf(route.endpoint);
    return (ACCOUNT_PLACEHOLDERS.some((name) => uses.has(name)) ||
        (uses.has('clientId') && !route.credential?.gccClientIdEnc) ||
        (uses.has('clientSecret') && !route.credential?.gccClientSecretEnc));
}
function gstRouteRefusal(route) {
    const { provider, service } = route;
    if (provider.gpvIsDeleted) {
        return `GST provider ${provider.gpvCode} is deleted`;
    }
    if (!provider.gpvIsActive) {
        return `GST provider ${provider.gpvCode} is inactive`;
    }
    if (!service) {
        return null;
    }
    const label = `${service.gpsService} · ${service.gpsEnvironment}`;
    if (service.gpsIsDeleted) {
        return `${label} service is deleted`;
    }
    if (!service.gpsIsActive) {
        return `${label} service is inactive`;
    }
    if (route.endpoint !== undefined) {
        if (!route.endpoint || route.endpoint.gpeIsDeleted) {
            return route.action ? `${label} has no ${route.action} endpoint` : `${label} has no endpoint`;
        }
        if (!route.endpoint.gpeIsActive) {
            return `${route.action ?? 'The'} endpoint of ${label} is inactive`;
        }
    }
    if (needsAccount(route)) {
        const account = route.account ?? null;
        if (!account || account.gpaIsDeleted) {
            return `${provider.gpvCode} has no ${service.gpsEnvironment} provider account`;
        }
        if (!account.gpaIsActive) {
            return `${provider.gpvCode} ${service.gpsEnvironment} provider account is inactive`;
        }
    }
    if (route.credential) {
        if (route.credential.gccIsDeleted) {
            return 'The GST credential is deleted';
        }
        if (!route.credential.gccIsActive) {
            return 'The GST credential is inactive';
        }
    }
    return null;
}
function assertGstRouteActive(route, options) {
    const refusal = gstRouteRefusal(route);
    if (refusal) {
        throw new common_1.HttpException((0, module_service_utils_1.buildSettingsErrorResponse)(options.title ?? 'GST service is switched off', [
            { field: options.field, message: refusal, code: gst_config_constants_1.GST_CODES.SWITCHED_OFF },
        ]), common_1.HttpStatus.SERVICE_UNAVAILABLE);
    }
}
//# sourceMappingURL=gst-route-guard.js.map