import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { swaggerModuleDocuments } from '../src/utils/swaggerDocs';

/**
 * The posting ledger map's Swagger page: that it exists, that all three routes
 * are on it, and that every DTO its responses reference actually resolves.
 *
 * A missing @ApiProperty or an unregistered module is invisible until someone
 * opens /api/docs/ledger-map and finds an empty page or a schema of `{}`.
 */
describe('ledger-map swagger', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d',
      user_name: 'tester1',
      sid: 'e2e-swagger',
      user_type: 'SUPER ADMIN',
      company_id: null,
      branch_id: null,
      device_id: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();
  }, 180_000);

  afterAll(async () => {
    await app.close();
  }, 60_000);

  const entry = () => swaggerModuleDocuments.find((d) => d.path === 'ledger-map');

  const build = () =>
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('t')
        .setVersion('1')
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
        .build(),
      { include: entry()!.include },
    );

  it('is registered as its own documented module', () => {
    expect(entry()).toBeDefined();
    expect(entry()!.title).toBe('Posting Ledger Map API');
  });

  it('puts all three routes on its own page', () => {
    const doc = build();
    const routes = Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.keys(item as object).map((method) => `${method.toUpperCase()} ${path}`),
    );
    expect(routes.sort()).toEqual([
      'DELETE /api/v1/ledger-map/delete',
      'GET /api/v1/ledger-map/roles',
      'POST /api/v1/ledger-map/create',
    ]);
  });

  it('resolves every response and body schema it references', () => {
    const doc = build();
    const schemas = doc.components?.schemas ?? {};

    for (const name of [
      'SaveLedgerMapDto',
      'LedgerMapRolePayloadDto',
      'LedgerMapRolesSuccessDto',
      'LedgerMapSuccessSingleDto',
      'LedgerMapSuccessDeleteDto',
      'LedgerMapDeleteResultDto',
      'LedgerMapErrorResponseDto',
      'LedgerMapErrorFieldDto',
    ]) {
      expect(Object.keys(schemas)).toContain(name);
    }

    // A schema with no properties is a DTO whose fields carry no @ApiProperty —
    // it renders as an empty box and tells a client nothing.
    for (const [name, schema] of Object.entries(schemas)) {
      const properties = (schema as { properties?: object }).properties ?? {};
      expect([name, Object.keys(properties).length > 0]).toEqual([name, true]);
    }

    // The reserved columns are refused, not documented as inputs.
    const saveDto = schemas['SaveLedgerMapDto'] as { properties: Record<string, unknown> };
    expect(Object.keys(saveDto.properties).sort()).toEqual([
      'almId',
      'isActive',
      'ledgerId',
      'remarks',
      'role',
    ]);

    // The roles envelope must point at the real row component, not a bare object.
    const rolesEnvelope = schemas['LedgerMapRolesSuccessDto'] as {
      properties: Record<string, { items?: { $ref?: string } }>;
    };
    expect(rolesEnvelope.properties.data.items?.$ref).toContain('LedgerMapRolePayloadDto');
  });

  it('carries the bearer-auth and tag metadata the other modules use', () => {
    const doc = build();
    const operation = doc.paths['/api/v1/ledger-map/roles'].get!;
    expect(operation.tags).toEqual(['Posting Ledger Map']);
    expect(operation.security).toEqual([{ 'access-token': [] }]);
  });
});
