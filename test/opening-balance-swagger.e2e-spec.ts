import '../src/env.preload';

import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from '../src/app.module';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { swaggerModuleDocuments } from '../src/utils/swaggerDocs';

/**
 * The opening balance module's Swagger page: that it exists, that every route
 * is on it, and that every DTO the responses reference actually resolves.
 *
 * A missing @ApiProperty or an unregistered module is invisible until someone
 * opens /api/docs/opening-balances and finds an empty page or a schema of `{}`,
 * which is exactly the sort of thing nobody notices before a client does.
 */
describe('opening-balances swagger', () => {
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

  const entry = () => swaggerModuleDocuments.find((d) => d.path === 'opening-balances');

  it('is registered as its own documented module', () => {
    expect(entry()).toBeDefined();
    expect(entry()!.title).toBe('Opening Balance API');
  });

  it('puts all seven operations (six paths) on its own page', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('t').setVersion('1').build(),
      { include: entry()!.include },
    );

    const routes = Object.entries(doc.paths).flatMap(([path, item]) =>
      Object.keys(item as object).map((method) => `${method.toUpperCase()} ${path}`),
    );

    expect(routes.sort()).toEqual([
      'DELETE /api/v1/opening-balances/delete',
      'GET /api/v1/opening-balances/bills',
      'GET /api/v1/opening-balances/list',
      'GET /api/v1/opening-balances/trial-balance',
      'POST /api/v1/opening-balances/bills',
      'POST /api/v1/opening-balances/carry-forward',
      'POST /api/v1/opening-balances/create',
    ]);
  });

  it('resolves every response and body schema it references', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('t').setVersion('1').build(),
      { include: entry()!.include },
    );
    const schemas = doc.components?.schemas ?? {};

    // The envelopes, the payloads inside them, and the row types inside those.
    for (const name of [
      'OpeningBalanceListSuccessDto',
      'OpeningBalanceListPayloadDto',
      'OpeningBalanceRowDto',
      'OpeningBalanceSaveSuccessDto',
      'OpeningBalanceSavePayloadDto',
      'TrialBalanceDto',
      'OpeningBillsSuccessDto',
      'OpeningBillsSavePayloadDto',
      'OpeningBillRowDto',
      'CarryForwardSuccessDto',
      'CarryForwardPayloadDto',
      'OpeningBalanceDeleteSuccessDto',
      'OpeningBalanceErrorResponseDto',
      'SaveOpeningBalanceDto',
      'SaveOpeningBalanceRowDto',
      'SaveOpeningBillsDto',
      'SaveOpeningBillRowDto',
      'CarryForwardDto',
    ]) {
      expect(Object.keys(schemas)).toContain(name);
    }

    // A schema with no properties is a DTO whose fields carry no @ApiProperty —
    // it renders as an empty box and tells a client nothing.
    for (const [name, schema] of Object.entries(schemas)) {
      const properties = (schema as { properties?: object }).properties ?? {};
      expect([name, Object.keys(properties).length > 0]).toEqual([name, true]);
    }

    // The nested arrays must point at real components, not bare objects.
    const listPayload = schemas['OpeningBalanceListPayloadDto'] as {
      properties: Record<string, { items?: { $ref?: string } }>;
    };
    expect(listPayload.properties.rows.items?.$ref).toContain('OpeningBalanceRowDto');
    expect(listPayload.properties.unclassified.items?.$ref).toContain('UnclassifiedLedgerDto');
  });

  it('carries the bearer-auth and tag metadata the other modules use', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('t')
        .setVersion('1')
        .addBearerAuth({ type: 'http', scheme: 'bearer' }, 'access-token')
        .build(),
      { include: entry()!.include },
    );

    const list = (doc.paths['/api/v1/opening-balances/list'] as { get: { security?: unknown[]; tags?: string[] } }).get;
    expect(list.tags).toContain('Opening Balances');
    expect(JSON.stringify(list.security)).toContain('access-token');
  });

  it('appears in the combined document too', () => {
    const all = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('t').setVersion('1').build(),
    );
    expect(Object.keys(all.paths)).toContain('/api/v1/opening-balances/list');
  });
});
