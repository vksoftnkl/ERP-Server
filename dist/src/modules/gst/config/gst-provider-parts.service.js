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
exports.GstProviderPartsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const gst_config_constants_1 = require("./gst-config.constants");
const gst_config_mappers_1 = require("./gst-config.mappers");
const gst_config_support_1 = require("./gst-config.support");
const SCREENS = {
    service: { table: 'gst provider service', screen: 'GST Provider Service' },
    endpoint: { table: 'gst provider endpoint', screen: 'GST Provider Endpoint' },
    fieldMap: { table: 'gst provider field map', screen: 'GST Provider Field Map' },
    errorMap: { table: 'gst provider error map', screen: 'GST Provider Error Map' },
};
let GstProviderPartsService = class GstProviderPartsService {
    prisma;
    support;
    constructor(prisma, support) {
        this.prisma = prisma;
        this.support = support;
    }
    async saveService(dto) {
        const creating = dto.gpsId === undefined;
        await this.requireSaveRight(creating, 'GST provider services');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.gstProviderService.findUnique({ where: { gpsId: dto.gpsId } });
                if (!creating && !existing) {
                    this.support.notFound('gpsId', 'GST provider service', dto.gpsId);
                }
                if (existing?.gpsIsDeleted) {
                    this.support.refuseDeleted('gpsId', 'GST provider service', existing.gpsId);
                }
                if (existing && existing.gpsGpvId !== dto.gpsGpvId) {
                    this.support.refuseParentChange('gpsGpvId', `provider ${existing.gpsGpvId}`);
                }
                await this.liveProvider(tx, dto.gpsGpvId, 'gpsGpvId');
                const ttl = (0, gst_config_support_1.keep)(dto.gpsTokenTtlMinutes, existing?.gpsTokenTtlMinutes, 360);
                const margin = (0, gst_config_support_1.keep)(dto.gpsRefreshMarginMinutes, existing?.gpsRefreshMarginMinutes, 15);
                if (margin >= ttl) {
                    this.support.badRequest([
                        {
                            field: 'gpsRefreshMarginMinutes',
                            message: `must be below gpsTokenTtlMinutes (${ttl}): renewing that early renews forever`,
                        },
                    ]);
                }
                const clash = await tx.gstProviderService.findFirst({
                    where: {
                        gpsGpvId: dto.gpsGpvId,
                        gpsService: dto.gpsService,
                        gpsEnvironment: dto.gpsEnvironment,
                        gpsIsDeleted: false,
                        ...(existing ? { gpsId: { not: existing.gpsId } } : {}),
                    },
                    select: { gpsId: true },
                });
                if (clash) {
                    this.duplicateService(dto, clash.gpsId);
                }
                const data = {
                    gpsService: dto.gpsService,
                    gpsEnvironment: dto.gpsEnvironment,
                    gpsBaseUrl: dto.gpsBaseUrl,
                    gpsFallbackUrls: (0, gst_config_support_1.keep)(dto.gpsFallbackUrls, existing?.gpsFallbackUrls, []),
                    gpsAuthScheme: dto.gpsAuthScheme,
                    gpsTokenTtlMinutes: ttl,
                    gpsRefreshMarginMinutes: margin,
                    gpsPayloadEncryption: (0, gst_config_support_1.keep)(dto.gpsPayloadEncryption, existing?.gpsPayloadEncryption, 'NONE'),
                    gpsTimeoutMs: (0, gst_config_support_1.keep)(dto.gpsTimeoutMs, existing?.gpsTimeoutMs, null),
                    gpsMaxRetries: (0, gst_config_support_1.keep)(dto.gpsMaxRetries, existing?.gpsMaxRetries, null),
                    gpsRemarks: (0, gst_config_support_1.keep)(dto.gpsRemarks, existing?.gpsRemarks, null),
                    gpsIsActive: (0, gst_config_support_1.keep)(dto.gpsIsActive, existing?.gpsIsActive, true),
                };
                const saved = existing
                    ? await tx.gstProviderService.update({
                        where: { gpsId: existing.gpsId },
                        data: { ...data, gpsModifiedOn: new Date(), gpsModifiedBy: actor },
                    })
                    : await tx.gstProviderService.create({
                        data: { ...data, gpsGpvId: dto.gpsGpvId, gpsCreatedBy: actor },
                    });
                const endpointCount = await this.endpointCount(tx, saved.gpsId);
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    ...SCREENS.service,
                    pk: saved.gpsId,
                    displayName: `${saved.gpsService} ${saved.gpsEnvironment}`,
                    before: existing ? (0, gst_config_mappers_1.toServicePayload)(existing, endpointCount) : null,
                    after: (0, gst_config_mappers_1.toServicePayload)(saved, endpointCount),
                    notes: existing ? 'GST provider service updated' : 'GST provider service created',
                });
                return (0, gst_config_mappers_1.toServicePayload)(saved, endpointCount);
            });
        }
        catch (error) {
            this.support.translateWriteError(error, [
                {
                    match: ['ux_gps_provider_service_env', 'gps_service'],
                    field: 'gpsEnvironment',
                    message: `The provider already has a live ${dto.gpsService} ${dto.gpsEnvironment} service.`,
                    code: gst_config_constants_1.GST_CODES.SERVICE_DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async deleteService(gpsId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'delete', 'delete GST provider services');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProviderService.findUnique({ where: { gpsId } });
            if (!existing) {
                this.support.notFound('gpsId', 'GST provider service', gpsId);
            }
            if (existing.gpsIsDeleted) {
                this.alreadyDeleted('gpsId', 'GST provider service');
            }
            const actor = this.support.actor();
            const now = new Date();
            const endpoints = await tx.gstProviderEndpoint.findMany({
                where: { gpeGpsId: gpsId, gpeIsDeleted: false },
                select: { gpeId: true },
            });
            const endpointIds = endpoints.map((e) => e.gpeId);
            if (endpointIds.length) {
                await tx.gstProviderFieldMap.updateMany({
                    where: { gfmGpeId: { in: endpointIds }, gfmIsDeleted: false },
                    data: { gfmIsDeleted: true, gfmModifiedOn: now, gfmModifiedBy: actor },
                });
                await tx.gstProviderEndpoint.updateMany({
                    where: { gpeId: { in: endpointIds } },
                    data: { gpeIsDeleted: true, gpeModifiedOn: now, gpeModifiedBy: actor },
                });
            }
            const updated = await tx.gstProviderService.update({
                where: { gpsId },
                data: { gpsIsDeleted: true, gpsModifiedOn: now, gpsModifiedBy: actor },
            });
            await this.support.audit(tx, {
                action: 'cancel',
                ...SCREENS.service,
                pk: gpsId,
                displayName: `${existing.gpsService} ${existing.gpsEnvironment}`,
                before: (0, gst_config_mappers_1.toServicePayload)(existing, endpointIds.length),
                after: (0, gst_config_mappers_1.toServicePayload)(updated, 0),
                notes: `GST provider service soft deleted, with ${endpointIds.length} endpoint(s)`,
            });
            return { gpsId, deleted: true, endpointsDeleted: endpointIds.length };
        });
    }
    async getEndpoint(gpeId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'view', 'view GST provider endpoints');
        const row = await this.prisma.gstProviderEndpoint.findUnique({
            where: { gpeId },
            include: { service: true },
        });
        if (!row) {
            this.support.notFound('gpeId', 'GST provider endpoint', gpeId);
        }
        const fieldMaps = await this.prisma.gstProviderFieldMap.findMany({
            where: { gfmGpeId: gpeId, gfmIsDeleted: false },
            orderBy: [{ gfmDirection: 'asc' }, { gfmSortOrder: 'asc' }, { gfmOurField: 'asc' }],
        });
        return { ...(0, gst_config_mappers_1.toEndpointPayload)(row, row.service), fieldMaps: fieldMaps.map(gst_config_mappers_1.toFieldMapPayload) };
    }
    async saveEndpoint(dto) {
        const creating = dto.gpeId === undefined;
        await this.requireSaveRight(creating, 'GST provider endpoints');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.gstProviderEndpoint.findUnique({ where: { gpeId: dto.gpeId } });
                if (!creating && !existing) {
                    this.support.notFound('gpeId', 'GST provider endpoint', dto.gpeId);
                }
                if (existing?.gpeIsDeleted) {
                    this.support.refuseDeleted('gpeId', 'GST provider endpoint', existing.gpeId);
                }
                if (existing && existing.gpeGpsId !== dto.gpeGpsId) {
                    this.support.refuseParentChange('gpeGpsId', `service ${existing.gpeGpsId}`);
                }
                const service = await this.liveService(tx, dto.gpeGpsId, 'gpeGpsId');
                const headers = this.validHeaders((0, gst_config_support_1.keep)(dto.gpeHeaders, this.storedHeaders(existing), null));
                const successPath = (0, gst_config_support_1.keep)(dto.gpeSuccessPath, existing?.gpeSuccessPath, null);
                const successValue = (0, gst_config_support_1.keep)(dto.gpeSuccessValue, existing?.gpeSuccessValue, null);
                if ((successPath === null) !== (successValue === null)) {
                    this.support.badRequest([
                        {
                            field: successPath === null ? 'gpeSuccessPath' : 'gpeSuccessValue',
                            message: 'gpeSuccessPath and gpeSuccessValue are set together, or neither',
                        },
                    ]);
                }
                const clash = await tx.gstProviderEndpoint.findFirst({
                    where: {
                        gpeGpsId: dto.gpeGpsId,
                        gpeAction: dto.gpeAction,
                        gpeIsDeleted: false,
                        ...(existing ? { gpeId: { not: existing.gpeId } } : {}),
                    },
                    select: { gpeId: true },
                });
                if (clash) {
                    this.support.conflict('Duplicate', 'gpeAction', `The service already has a live ${dto.gpeAction} endpoint (${clash.gpeId}).`, gst_config_constants_1.GST_CODES.ENDPOINT_DUPLICATE);
                }
                const redact = (0, gst_config_support_1.keep)(dto.gpeRedactPaths, Array.isArray(existing?.gpeRedactPaths) ? existing.gpeRedactPaths : null, null);
                const data = {
                    gpeAction: dto.gpeAction,
                    gpeHttpMethod: (0, gst_config_support_1.keep)(dto.gpeHttpMethod, existing?.gpeHttpMethod, 'POST'),
                    gpePathTemplate: dto.gpePathTemplate,
                    gpeQueryTemplate: (0, gst_config_support_1.keep)(dto.gpeQueryTemplate, existing?.gpeQueryTemplate, null),
                    gpeContentType: (0, gst_config_support_1.keep)(dto.gpeContentType, existing?.gpeContentType, 'application/json'),
                    gpeHeaders: headers ?? client_1.Prisma.DbNull,
                    gpeRequestWrapper: (0, gst_config_support_1.keep)(dto.gpeRequestWrapper, existing?.gpeRequestWrapper, null),
                    gpeRedactPaths: redact ?? client_1.Prisma.DbNull,
                    gpeResponseRootPath: (0, gst_config_support_1.keep)(dto.gpeResponseRootPath, existing?.gpeResponseRootPath, null),
                    gpeSuccessPath: successPath,
                    gpeSuccessValue: successValue,
                    gpeErrorCodePath: (0, gst_config_support_1.keep)(dto.gpeErrorCodePath, existing?.gpeErrorCodePath, null),
                    gpeErrorMessagePath: (0, gst_config_support_1.keep)(dto.gpeErrorMessagePath, existing?.gpeErrorMessagePath, null),
                    gpeTimeoutMs: (0, gst_config_support_1.keep)(dto.gpeTimeoutMs, existing?.gpeTimeoutMs, null),
                    gpeMaxRetries: (0, gst_config_support_1.keep)(dto.gpeMaxRetries, existing?.gpeMaxRetries, null),
                    gpeIsIdempotent: (0, gst_config_support_1.keep)(dto.gpeIsIdempotent, existing?.gpeIsIdempotent, false),
                    gpeRemarks: (0, gst_config_support_1.keep)(dto.gpeRemarks, existing?.gpeRemarks, null),
                    gpeIsActive: (0, gst_config_support_1.keep)(dto.gpeIsActive, existing?.gpeIsActive, true),
                };
                const saved = existing
                    ? await tx.gstProviderEndpoint.update({
                        where: { gpeId: existing.gpeId },
                        data: { ...data, gpeModifiedOn: new Date(), gpeModifiedBy: actor },
                    })
                    : await tx.gstProviderEndpoint.create({
                        data: { ...data, gpeGpsId: dto.gpeGpsId, gpeCreatedBy: actor },
                    });
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    ...SCREENS.endpoint,
                    pk: saved.gpeId,
                    displayName: `${service.gpsService} ${service.gpsEnvironment} ${saved.gpeAction}`,
                    before: existing ? (0, gst_config_mappers_1.toEndpointPayload)(existing, service) : null,
                    after: (0, gst_config_mappers_1.toEndpointPayload)(saved, service),
                    notes: existing ? 'GST provider endpoint updated' : 'GST provider endpoint created',
                });
                const fieldMaps = await tx.gstProviderFieldMap.findMany({
                    where: { gfmGpeId: saved.gpeId, gfmIsDeleted: false },
                    orderBy: [{ gfmDirection: 'asc' }, { gfmSortOrder: 'asc' }, { gfmOurField: 'asc' }],
                });
                return {
                    ...(0, gst_config_mappers_1.toEndpointPayload)(saved, service),
                    fieldMaps: fieldMaps.map(gst_config_mappers_1.toFieldMapPayload),
                };
            });
        }
        catch (error) {
            this.support.translateWriteError(error, [
                {
                    match: ['ux_gpe_service_action', 'gpe_action'],
                    field: 'gpeAction',
                    message: `The service already has a live ${dto.gpeAction} endpoint.`,
                    code: gst_config_constants_1.GST_CODES.ENDPOINT_DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async deleteEndpoint(gpeId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'delete', 'delete GST provider endpoints');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProviderEndpoint.findUnique({
                where: { gpeId },
                include: { service: true },
            });
            if (!existing) {
                this.support.notFound('gpeId', 'GST provider endpoint', gpeId);
            }
            if (existing.gpeIsDeleted) {
                this.alreadyDeleted('gpeId', 'GST provider endpoint');
            }
            const actor = this.support.actor();
            const now = new Date();
            const { count: fieldMapsDeleted } = await tx.gstProviderFieldMap.updateMany({
                where: { gfmGpeId: gpeId, gfmIsDeleted: false },
                data: { gfmIsDeleted: true, gfmModifiedOn: now, gfmModifiedBy: actor },
            });
            const updated = await tx.gstProviderEndpoint.update({
                where: { gpeId },
                data: { gpeIsDeleted: true, gpeModifiedOn: now, gpeModifiedBy: actor },
            });
            await this.support.audit(tx, {
                action: 'cancel',
                ...SCREENS.endpoint,
                pk: gpeId,
                displayName: `${existing.service.gpsService} ${existing.service.gpsEnvironment} ${existing.gpeAction}`,
                before: (0, gst_config_mappers_1.toEndpointPayload)(existing, existing.service),
                after: (0, gst_config_mappers_1.toEndpointPayload)(updated, existing.service),
                notes: `GST provider endpoint soft deleted, with ${fieldMapsDeleted} field map row(s)`,
            });
            return { gpeId, deleted: true, fieldMapsDeleted };
        });
    }
    async saveFieldMap(dto) {
        const creating = dto.gfmId === undefined;
        await this.requireSaveRight(creating, 'GST provider field maps');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.gstProviderFieldMap.findUnique({ where: { gfmId: dto.gfmId } });
                if (!creating && !existing) {
                    this.support.notFound('gfmId', 'GST provider field map', dto.gfmId);
                }
                if (existing?.gfmIsDeleted) {
                    this.support.refuseDeleted('gfmId', 'GST provider field map', existing.gfmId);
                }
                if (existing && existing.gfmGpeId !== dto.gfmGpeId) {
                    this.support.refuseParentChange('gfmGpeId', `endpoint ${existing.gfmGpeId}`);
                }
                await this.liveEndpoint(tx, dto.gfmGpeId, 'gfmGpeId');
                const isRequired = (0, gst_config_support_1.keep)(dto.gfmIsRequired, existing?.gfmIsRequired, false);
                const defaultValue = (0, gst_config_support_1.keep)(dto.gfmDefaultValue, existing?.gfmDefaultValue, null);
                const transform = (0, gst_config_support_1.keep)(dto.gfmTransform, existing?.gfmTransform, 'NONE');
                const formatMask = (0, gst_config_support_1.keep)(dto.gfmFormatMask, existing?.gfmFormatMask, null);
                const errors = [];
                if (isRequired && defaultValue !== null) {
                    errors.push({
                        field: 'gfmDefaultValue',
                        message: 'a required field may not carry a default: it would hide the absence the flag catches',
                    });
                }
                if (transform === 'DATETIME_MASK' && formatMask === null) {
                    errors.push({
                        field: 'gfmFormatMask',
                        message: 'DATETIME_MASK parses with gfmFormatMask; set it',
                    });
                }
                if (errors.length) {
                    this.support.badRequest(errors);
                }
                const clash = await tx.gstProviderFieldMap.findFirst({
                    where: {
                        gfmGpeId: dto.gfmGpeId,
                        gfmDirection: dto.gfmDirection,
                        gfmOurField: dto.gfmOurField,
                        gfmIsDeleted: false,
                        ...(existing ? { gfmId: { not: existing.gfmId } } : {}),
                    },
                    select: { gfmId: true },
                });
                if (clash) {
                    this.support.conflict('Duplicate', 'gfmOurField', `The endpoint already maps ${dto.gfmDirection} ${dto.gfmOurField} (${clash.gfmId}).`, gst_config_constants_1.GST_CODES.FIELD_MAP_DUPLICATE);
                }
                const data = {
                    gfmDirection: dto.gfmDirection,
                    gfmOurField: dto.gfmOurField,
                    gfmTheirPath: dto.gfmTheirPath,
                    gfmDataType: (0, gst_config_support_1.keep)(dto.gfmDataType, existing?.gfmDataType, 'TEXT'),
                    gfmTransform: transform,
                    gfmFormatMask: formatMask,
                    gfmIsRequired: isRequired,
                    gfmDefaultValue: defaultValue,
                    gfmTargetColumn: (0, gst_config_support_1.keep)(dto.gfmTargetColumn, existing?.gfmTargetColumn, null),
                    gfmSortOrder: (0, gst_config_support_1.keep)(dto.gfmSortOrder, existing?.gfmSortOrder, 0),
                };
                const saved = existing
                    ? await tx.gstProviderFieldMap.update({
                        where: { gfmId: existing.gfmId },
                        data: { ...data, gfmModifiedOn: new Date(), gfmModifiedBy: actor },
                    })
                    : await tx.gstProviderFieldMap.create({
                        data: { ...data, gfmGpeId: dto.gfmGpeId, gfmCreatedBy: actor },
                    });
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    ...SCREENS.fieldMap,
                    pk: saved.gfmId,
                    displayName: `${saved.gfmDirection} ${saved.gfmOurField}`,
                    before: existing ? (0, gst_config_mappers_1.toFieldMapPayload)(existing) : null,
                    after: (0, gst_config_mappers_1.toFieldMapPayload)(saved),
                    notes: existing ? 'GST provider field map updated' : 'GST provider field map created',
                });
                return (0, gst_config_mappers_1.toFieldMapPayload)(saved);
            });
        }
        catch (error) {
            this.support.translateWriteError(error, [
                {
                    match: ['ux_gfm_endpoint_field', 'gfm_our_field'],
                    field: 'gfmOurField',
                    message: `The endpoint already maps ${dto.gfmDirection} ${dto.gfmOurField}.`,
                    code: gst_config_constants_1.GST_CODES.FIELD_MAP_DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async deleteFieldMap(gfmId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'delete', 'delete GST provider field maps');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProviderFieldMap.findUnique({ where: { gfmId } });
            if (!existing) {
                this.support.notFound('gfmId', 'GST provider field map', gfmId);
            }
            if (existing.gfmIsDeleted) {
                this.alreadyDeleted('gfmId', 'GST provider field map');
            }
            const updated = await tx.gstProviderFieldMap.update({
                where: { gfmId },
                data: {
                    gfmIsDeleted: true,
                    gfmModifiedOn: new Date(),
                    gfmModifiedBy: this.support.actor(),
                },
            });
            await this.support.audit(tx, {
                action: 'cancel',
                ...SCREENS.fieldMap,
                pk: gfmId,
                displayName: `${existing.gfmDirection} ${existing.gfmOurField}`,
                before: (0, gst_config_mappers_1.toFieldMapPayload)(existing),
                after: (0, gst_config_mappers_1.toFieldMapPayload)(updated),
                notes: 'GST provider field map soft deleted',
            });
            return { gfmId, deleted: true };
        });
    }
    async saveErrorMap(dto) {
        const creating = dto.gemId === undefined;
        await this.requireSaveRight(creating, 'GST provider error maps');
        const actor = this.support.actor();
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = creating
                    ? null
                    : await tx.gstProviderErrorMap.findUnique({ where: { gemId: dto.gemId } });
                if (!creating && !existing) {
                    this.support.notFound('gemId', 'GST provider error map', dto.gemId);
                }
                if (existing?.gemIsDeleted) {
                    this.support.refuseDeleted('gemId', 'GST provider error map', existing.gemId);
                }
                if (existing && existing.gemGpvId !== dto.gemGpvId) {
                    this.support.refuseParentChange('gemGpvId', `provider ${existing.gemGpvId}`);
                }
                await this.liveProvider(tx, dto.gemGpvId, 'gemGpvId');
                const service = (0, gst_config_support_1.keep)(dto.gemService, existing?.gemService, null);
                const treatAs = (0, gst_config_support_1.keep)(dto.gemTreatAs, existing?.gemTreatAs, 'ERROR');
                const extractPath = (0, gst_config_support_1.keep)(dto.gemExtractPath, existing?.gemExtractPath, null);
                const canonicalField = (0, gst_config_support_1.keep)(dto.gemCanonicalField, existing?.gemCanonicalField, null);
                if (treatAs === 'SUCCESS' && (extractPath === null || canonicalField === null)) {
                    this.support.badRequest([
                        extractPath === null ? 'gemExtractPath' : null,
                        canonicalField === null ? 'gemCanonicalField' : null,
                    ]
                        .filter((field) => field !== null)
                        .map((field) => ({
                        field,
                        message: 'treat-as SUCCESS completes the document with a value taken from the error: say where it is and what it becomes',
                    })));
                }
                const clash = await tx.gstProviderErrorMap.findFirst({
                    where: {
                        gemGpvId: dto.gemGpvId,
                        gemService: service,
                        gemTheirCode: dto.gemTheirCode,
                        gemIsDeleted: false,
                        ...(existing ? { gemId: { not: existing.gemId } } : {}),
                    },
                    select: { gemId: true },
                });
                if (clash) {
                    this.support.conflict('Duplicate', 'gemTheirCode', `Code ${dto.gemTheirCode} is already mapped for ${service ?? 'every service'} (${clash.gemId}).`, gst_config_constants_1.GST_CODES.ERROR_MAP_DUPLICATE);
                }
                const data = {
                    gemService: service,
                    gemTheirCode: dto.gemTheirCode,
                    gemOurCode: dto.gemOurCode,
                    gemMessage: (0, gst_config_support_1.keep)(dto.gemMessage, existing?.gemMessage, null),
                    gemTreatAs: treatAs,
                    gemExtractPath: extractPath,
                    gemCanonicalField: canonicalField,
                    gemIsRetryable: (0, gst_config_support_1.keep)(dto.gemIsRetryable, existing?.gemIsRetryable, false),
                    gemRetryAfterSeconds: (0, gst_config_support_1.keep)(dto.gemRetryAfterSeconds, existing?.gemRetryAfterSeconds, null),
                    gemShouldReauth: (0, gst_config_support_1.keep)(dto.gemShouldReauth, existing?.gemShouldReauth, false),
                    gemRecoveryAction: (0, gst_config_support_1.keep)(dto.gemRecoveryAction, existing?.gemRecoveryAction, 'NONE'),
                    gemSeverity: (0, gst_config_support_1.keep)(dto.gemSeverity, existing?.gemSeverity, 'ERROR'),
                };
                const saved = existing
                    ? await tx.gstProviderErrorMap.update({
                        where: { gemId: existing.gemId },
                        data: { ...data, gemModifiedOn: new Date(), gemModifiedBy: actor },
                    })
                    : await tx.gstProviderErrorMap.create({
                        data: { ...data, gemGpvId: dto.gemGpvId, gemCreatedBy: actor },
                    });
                await this.support.audit(tx, {
                    action: existing ? 'update' : 'New',
                    ...SCREENS.errorMap,
                    pk: saved.gemId,
                    displayName: `${saved.gemTheirCode} → ${saved.gemOurCode}`,
                    before: existing ? (0, gst_config_mappers_1.toErrorMapPayload)(existing) : null,
                    after: (0, gst_config_mappers_1.toErrorMapPayload)(saved),
                    notes: existing ? 'GST provider error map updated' : 'GST provider error map created',
                });
                return (0, gst_config_mappers_1.toErrorMapPayload)(saved);
            });
        }
        catch (error) {
            this.support.translateWriteError(error, [
                {
                    match: ['ux_gem_provider_code', 'gem_their_code'],
                    field: 'gemTheirCode',
                    message: `Code ${dto.gemTheirCode} is already mapped for that service.`,
                    code: gst_config_constants_1.GST_CODES.ERROR_MAP_DUPLICATE,
                },
            ]);
            throw error;
        }
    }
    async deleteErrorMap(gemId) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, 'delete', 'delete GST provider error maps');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.gstProviderErrorMap.findUnique({ where: { gemId } });
            if (!existing) {
                this.support.notFound('gemId', 'GST provider error map', gemId);
            }
            if (existing.gemIsDeleted) {
                this.alreadyDeleted('gemId', 'GST provider error map');
            }
            const updated = await tx.gstProviderErrorMap.update({
                where: { gemId },
                data: {
                    gemIsDeleted: true,
                    gemModifiedOn: new Date(),
                    gemModifiedBy: this.support.actor(),
                },
            });
            await this.support.audit(tx, {
                action: 'cancel',
                ...SCREENS.errorMap,
                pk: gemId,
                displayName: `${existing.gemTheirCode} → ${existing.gemOurCode}`,
                before: (0, gst_config_mappers_1.toErrorMapPayload)(existing),
                after: (0, gst_config_mappers_1.toErrorMapPayload)(updated),
                notes: 'GST provider error map soft deleted',
            });
            return { gemId, deleted: true };
        });
    }
    async requireSaveRight(creating, what) {
        await this.support.requireRight(gst_config_constants_1.GST_PROVIDERS_MENU, creating ? 'create' : 'edit', `${creating ? 'create' : 'edit'} ${what}`);
    }
    async liveProvider(tx, gpvId, field) {
        const provider = await tx.gstProvider.findUnique({
            where: { gpvId },
            select: { gpvIsDeleted: true },
        });
        if (!provider) {
            this.support.notFound(field, 'GST provider', gpvId);
        }
        if (provider.gpvIsDeleted) {
            this.support.refuseDeleted(field, 'GST provider', gpvId);
        }
    }
    async liveService(tx, gpsId, field) {
        const service = await tx.gstProviderService.findUnique({ where: { gpsId } });
        if (!service) {
            this.support.notFound(field, 'GST provider service', gpsId);
        }
        if (service.gpsIsDeleted) {
            this.support.refuseDeleted(field, 'GST provider service', gpsId);
        }
        await this.liveProvider(tx, service.gpsGpvId, field);
        return service;
    }
    async liveEndpoint(tx, gpeId, field) {
        const endpoint = await tx.gstProviderEndpoint.findUnique({ where: { gpeId } });
        if (!endpoint) {
            this.support.notFound(field, 'GST provider endpoint', gpeId);
        }
        if (endpoint.gpeIsDeleted) {
            this.support.refuseDeleted(field, 'GST provider endpoint', gpeId);
        }
        await this.liveService(tx, endpoint.gpeGpsId, field);
        return endpoint;
    }
    endpointCount(client, gpsId) {
        return client.gstProviderEndpoint.count({ where: { gpeGpsId: gpsId, gpeIsDeleted: false } });
    }
    storedHeaders(existing) {
        if (!existing) {
            return undefined;
        }
        const value = existing.gpeHeaders;
        return value && typeof value === 'object' && !Array.isArray(value)
            ? value
            : null;
    }
    validHeaders(headers) {
        if (headers === null) {
            return null;
        }
        const errors = Object.entries(headers)
            .filter(([name, value]) => typeof value !== 'string' || !name.trim())
            .map(([name]) => ({
            field: `gpeHeaders.${name}`,
            message: 'a header needs a name and a string value (a template such as "{gstin}")',
        }));
        if (errors.length) {
            this.support.badRequest(errors);
        }
        return headers;
    }
    duplicateService(dto, clashId) {
        this.support.conflict('Duplicate', 'gpsEnvironment', `The provider already has a live ${dto.gpsService} ${dto.gpsEnvironment} service (${clashId}).`, gst_config_constants_1.GST_CODES.SERVICE_DUPLICATE);
    }
    alreadyDeleted(field, what) {
        this.support.conflict(`${what} is already deleted`, field, 'Nothing to delete.', gst_config_constants_1.GST_CODES.ALREADY_DELETED);
    }
};
exports.GstProviderPartsService = GstProviderPartsService;
exports.GstProviderPartsService = GstProviderPartsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        gst_config_support_1.GstConfigSupport])
], GstProviderPartsService);
//# sourceMappingURL=gst-provider-parts.service.js.map