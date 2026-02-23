import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import * as compression from 'compression';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FileLoggerService } from './common/logging/file-logger.service';
import { PrismaService } from './database/prisma/prisma.service';
import { swaggerModuleDocuments } from './utils/swaggerDocs';

const parseBoolean = (value: string | undefined, defaultValue = false): boolean => {
  if (value === undefined) {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const resolveFilePath = (filePath: string): string => {
  const isPkgRuntime = Boolean((process as NodeJS.Process & { pkg?: unknown }).pkg);

  if (isAbsolute(filePath)) {
    return filePath;
  }

  const cwdPath = resolve(process.cwd(), filePath);
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  if (isPkgRuntime) {
    const execDirPath = resolve(dirname(process.execPath), filePath);
    if (existsSync(execDirPath)) {
      return execDirPath;
    }

    const snapshotPath = resolve(__dirname, '..', filePath);
    if (existsSync(snapshotPath)) {
      return snapshotPath;
    }
  }

  return cwdPath;
};

const normalizeUrlPath = (path: string): string => {
  const cleanedPath = path.replace(/^\/+|\/+$/g, '');
  return cleanedPath ? `/${cleanedPath}` : '';
};

const buildAbsoluteUrl = (baseUrl: string, path: string): string => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');
  const normalizedPath = normalizeUrlPath(path);
  return `${normalizedBaseUrl}${normalizedPath}`;
};

const buildHttpsOptions = () => {
  if (!parseBoolean(process.env.HTTPS_ENABLED, false)) {
    return undefined;
  }

  const certPath = process.env.HTTPS_CERT_PATH;
  const keyPath = process.env.HTTPS_KEY_PATH;
  if (!certPath || !keyPath) {
    throw new Error('HTTPS_ENABLED=true requires HTTPS_CERT_PATH and HTTPS_KEY_PATH.');
  }

  const resolvedCertPath = resolveFilePath(certPath);
  const resolvedKeyPath = resolveFilePath(keyPath);

  return {
    cert: readFileSync(resolvedCertPath),
    key: readFileSync(resolvedKeyPath),
    passphrase: process.env.HTTPS_PASSPHRASE || undefined,
  };
};

const buildSwaggerConfig = (title: string, description: string) =>
  new DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste access token as JWT (without Bearer prefix).',
      },
      'access-token',
    )
    // Use current origin so Swagger "Try it out" works on localhost, IPv6, and proxied hosts.
    // API paths already include the global prefix (e.g. /api/v1/*), so root-relative is required.
    .addServer('/')
    .build();

async function bootstrap(): Promise<void> {
  const httpsOptions = buildHttpsOptions();
  const logger = new FileLoggerService();
  const app = await NestFactory.create(AppModule, {
    logger,
    ...(httpsOptions ? { httpsOptions } : {}),
  });
  app.useLogger(logger);
  const configService = app.get(ConfigService);
  const requestBodyLimit = configService.get<string>('app.requestBodyLimit', '10mb');
  const swaggerModuleDocs = swaggerModuleDocuments;
  app.enableShutdownHooks();
  app.use(json({ limit: requestBodyLimit }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit }));
  app.use(helmet());
  app.use(compression());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const rawApiPrefix = configService.get<string>('app.apiPrefix', 'api');
  const apiPrefix = rawApiPrefix.replace(/^\/+|\/+$/g, '');
  if (apiPrefix) {
    app.setGlobalPrefix(apiPrefix);
  }

  const port = configService.get<number>('app.port', 3000);
  const host = configService.get<string>('app.host', '0.0.0.0');
  const allDocsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
  const allSwaggerDocument = SwaggerModule.createDocument(
    app,
    buildSwaggerConfig('ERP Server API', 'API documentation for ERP Server'),
  );
  SwaggerModule.setup(allDocsPath, app, allSwaggerDocument);

  for (const docs of swaggerModuleDocs) {
    const docsPath = apiPrefix ? `${apiPrefix}/docs/${docs.path}` : `docs/${docs.path}`;
    const moduleSwaggerDocument = SwaggerModule.createDocument(
      app,
      buildSwaggerConfig(docs.title, docs.description),
      {
        include: docs.include,
      },
    );
    SwaggerModule.setup(docsPath, app, moduleSwaggerDocument);
  }

  await app.listen(port, host);

  const appUrl = await app.getUrl();
  const docsUrl = buildAbsoluteUrl(appUrl, allDocsPath);

  const prisma = app.get(PrismaService);
  let isDbConnected = false;
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    isDbConnected = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Database startup check failed: ${errorMessage}`, undefined, 'Bootstrap');
  }

  logger.log(`API docs URL: ${docsUrl}`, 'Bootstrap');
  for (const docs of swaggerModuleDocs) {
    const docsPath = apiPrefix ? `${apiPrefix}/docs/${docs.path}` : `docs/${docs.path}`;
    logger.log(`API docs URL (${docs.path}): ${buildAbsoluteUrl(appUrl, docsPath)}`, 'Bootstrap');
  }
  logger.log(`DB connected: ${isDbConnected}`, 'Bootstrap');
}

void bootstrap();
