import '../../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { AuthSessionService } from '../../src/modules/auth/auth-session.service';
import { TokenService, type AccessTokenPayload } from '../../src/modules/auth/token.service';
import { BRANCH, COMPANY } from './payment-e2e';
import { TESTER1 } from './menu-rights';

/**
 * One app that plays many logins: the stubbed token service reads
 * `Bearer <user>@<device>` (a key of `users`, a device_master id), so a request
 * picks who it is and which machine it comes from. A bearer without an `@`
 * (the shared helpers' 'dummy-test-token') is `fallback()` — change what it
 * returns to send those helpers from a device. The real guard, validation pipe
 * and filters run, as in bootApp (payment-e2e.ts).
 */
export interface Identity {
  sub: string;
  user_name: string;
  user_type: string;
}

export const TESTER = '019e44fb-5d08-7b17-ad05-9e519f179708'; // user 'tester'
export const PRATHAP = '019e43d9-ac09-7676-aaeb-7fac92edb6a5'; // user 'prathap'
export const IDENTITIES: Record<string, Identity> = {
  tester1: { sub: TESTER1, user_name: 'tester1', user_type: 'SUPER ADMIN' },
  prathap: { sub: PRATHAP, user_name: 'prathap', user_type: 'USER' },
  tester: { sub: TESTER, user_name: 'tester', user_type: 'USER' },
};

export const as = (who: string, device: string) => `Bearer ${who}@${device}`;

export async function bootIdentityApp(
  fallback: () => { who: string; device: string | null } = () => ({ who: 'tester1', device: null }),
  users: Record<string, Identity> = IDENTITIES,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(TokenService)
    .useValue({
      verifyAccessToken: (token: string): AccessTokenPayload => {
        const at = token.indexOf('@');
        const { who, device } =
          at < 0 ? fallback() : { who: token.slice(0, at), device: token.slice(at + 1) || null };
        const user = users[who] ?? users.tester1;
        return {
          sub: user.sub,
          user_name: user.user_name,
          sid: `e2e-identity-${who}`,
          user_type: user.user_type,
          company_id: COMPANY,
          branch_id: BRANCH,
          device_id: device,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          typ: 'access',
        };
      },
    })
    .overrideProvider(AuthSessionService)
    .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
    .compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: process.env.API_VERSION ?? '1',
  });
  app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
  await app.init();
  return app;
}
