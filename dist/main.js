"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const compression = require("compression");
const express_1 = require("express");
const helmet_1 = require("helmet");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./app.module");
const file_logger_service_1 = require("./common/logging/file-logger.service");
const prisma_service_1 = require("./database/prisma/prisma.service");
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined) {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};
const resolveFilePath = (filePath) => (0, node_path_1.isAbsolute)(filePath) ? filePath : (0, node_path_1.resolve)(process.cwd(), filePath);
const normalizeUrlPath = (path) => {
    const cleanedPath = path.replace(/^\/+|\/+$/g, '');
    return cleanedPath ? `/${cleanedPath}` : '';
};
const buildAbsoluteUrl = (baseUrl, path) => {
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
        cert: (0, node_fs_1.readFileSync)(resolvedCertPath),
        key: (0, node_fs_1.readFileSync)(resolvedKeyPath),
        passphrase: process.env.HTTPS_PASSPHRASE || undefined,
    };
};
async function bootstrap() {
    const httpsOptions = buildHttpsOptions();
    const logger = new file_logger_service_1.FileLoggerService();
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        logger,
        ...(httpsOptions ? { httpsOptions } : {}),
    });
    app.useLogger(logger);
    const configService = app.get(config_1.ConfigService);
    const requestBodyLimit = configService.get('app.requestBodyLimit', '10mb');
    app.enableShutdownHooks();
    app.use((0, express_1.json)({ limit: requestBodyLimit }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: requestBodyLimit }));
    app.use((0, helmet_1.default)());
    app.use(compression());
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
    }));
    app.enableVersioning({
        type: common_1.VersioningType.URI,
        defaultVersion: '1',
    });
    const rawApiPrefix = configService.get('app.apiPrefix', 'api');
    const apiPrefix = rawApiPrefix.replace(/^\/+|\/+$/g, '');
    if (apiPrefix) {
        app.setGlobalPrefix(apiPrefix);
    }
    const port = configService.get('app.port', 3000);
    const swaggerConfig = new swagger_1.DocumentBuilder()
        .setTitle('ERP Server API')
        .setDescription('API documentation for ERP Server')
        .setVersion('1.0.0')
        .addServer('/')
        .build();
    const swaggerDocument = swagger_1.SwaggerModule.createDocument(app, swaggerConfig);
    swagger_1.SwaggerModule.setup(apiPrefix ? `${apiPrefix}/docs` : 'docs', app, swaggerDocument);
    await app.listen(port);
    const appUrl = await app.getUrl();
    const docsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
    const docsUrl = buildAbsoluteUrl(appUrl, docsPath);
    const prisma = app.get(prisma_service_1.PrismaService);
    let isDbConnected = false;
    try {
        await prisma.$queryRawUnsafe('SELECT 1');
        isDbConnected = true;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Database startup check failed: ${errorMessage}`, undefined, 'Bootstrap');
    }
    logger.log(`API docs URL: ${docsUrl}`, 'Bootstrap');
    logger.log(`DB connected: ${isDbConnected}`, 'Bootstrap');
}
void bootstrap();
//# sourceMappingURL=main.js.map