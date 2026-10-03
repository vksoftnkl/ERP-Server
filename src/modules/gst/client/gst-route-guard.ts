import { HttpException, HttpStatus } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { buildSettingsErrorResponse } from 'src/common/utils/module-service.utils';
import { GST_CODES } from '../config/gst-config.constants';

/**
 * Notes 88 — "Without an active provider, don't allow any service." Every call
 * that leaves this server for a GSP or NIC runs on rows the GST Provider and
 * GST Credential screens switch on and off, and refuses — 503, before anything
 * is sent or logged — while any of them is off:
 *
 *   provider   the master switch
 *   service    the service × environment being called
 *   endpoint   the action being called
 *   account    the provider account for that environment, when the endpoint
 *              needs {aspId} / {aspPassword} / {apiKey}, or a {clientId} /
 *              {clientSecret} the credential does not carry itself
 *   credential the taxpayer's login, for a call made for a taxpayer
 *
 * The first row that is off is named, in that order. Callers check early, so
 * the refusal comes before a lease or a log row; GstHttpClient.send checks the
 * same route again as the one door to the network, so a new call cannot
 * forget it. A live gst_auth_session survives a switch-off untouched — the
 * next call simply refuses here.
 */

const ACCOUNT_PLACEHOLDERS = ['aspId', 'aspPassword', 'apiKey'] as const;

export interface GstRoute {
  provider: { gpvCode: string; gpvIsActive: boolean; gpvIsDeleted: boolean };
  /** The service being called; leave it out to check the provider alone. */
  service?: {
    gpsService: string;
    gpsEnvironment: string;
    gpsIsActive: boolean;
    gpsIsDeleted: boolean;
  };
  /** The action being called, named when its endpoint is missing. */
  action?: string;
  /** null: the service has no such endpoint. */
  endpoint?: {
    gpeIsActive: boolean;
    gpeIsDeleted: boolean;
    gpePathTemplate: string;
    gpeQueryTemplate: string | null;
    gpeHeaders: Prisma.JsonValue | null;
  } | null;
  /** null: the provider has no account for the environment. */
  account?: { gpaIsActive: boolean; gpaIsDeleted: boolean } | null;
  credential?: {
    gccIsActive: boolean;
    gccIsDeleted: boolean;
    gccClientIdEnc: string | null;
    gccClientSecretEnc: string | null;
  };
}

/** Every {placeholder} the endpoint's path, query and header templates use. */
export function placeholdersOf(endpoint: NonNullable<GstRoute['endpoint']>): Set<string> {
  const headers = endpoint.gpeHeaders;
  const texts = [
    endpoint.gpePathTemplate,
    endpoint.gpeQueryTemplate ?? '',
    ...(headers && typeof headers === 'object' && !Array.isArray(headers)
      ? Object.values(headers).map((v) => (typeof v === 'string' ? v : ''))
      : []),
  ];
  const names = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(/\{(\w+)\}/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

/** Whether the call needs a value only a provider account holds. */
function needsAccount(route: GstRoute): boolean {
  if (!route.endpoint) {
    return false;
  }
  const uses = placeholdersOf(route.endpoint);
  return (
    ACCOUNT_PLACEHOLDERS.some((name) => uses.has(name)) ||
    (uses.has('clientId') && !route.credential?.gccClientIdEnc) ||
    (uses.has('clientSecret') && !route.credential?.gccClientSecretEnc)
  );
}

/** The first row of the route that is switched off, in words; null when every one is on. */
export function gstRouteRefusal(route: GstRoute): string | null {
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

/** 503 GST_SWITCHED_OFF naming the first row that is off; nothing has been sent. */
export function assertGstRouteActive(
  route: GstRoute,
  options: { field: string; title?: string },
): void {
  const refusal = gstRouteRefusal(route);
  if (refusal) {
    throw new HttpException(
      buildSettingsErrorResponse(options.title ?? 'GST service is switched off', [
        { field: options.field, message: refusal, code: GST_CODES.SWITCHED_OFF },
      ]),
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
