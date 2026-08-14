"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./env.preload");
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
const swaggerDocs_1 = require("./utils/swaggerDocs");
const parseBoolean = (value, defaultValue = false) => {
    if (value === undefined) {
        return defaultValue;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};
const parseCsv = (value) => {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
};
const getDefaultDevCorsOrigins = () => [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://127.0.0.1:3000',
    'https://127.0.0.1:3000',
];
const resolveFilePath = (filePath) => {
    const isPkgRuntime = Boolean(process.pkg);
    if ((0, node_path_1.isAbsolute)(filePath)) {
        return filePath;
    }
    const cwdPath = (0, node_path_1.resolve)(process.cwd(), filePath);
    if ((0, node_fs_1.existsSync)(cwdPath)) {
        return cwdPath;
    }
    if (isPkgRuntime) {
        const execDirPath = (0, node_path_1.resolve)((0, node_path_1.dirname)(process.execPath), filePath);
        if ((0, node_fs_1.existsSync)(execDirPath)) {
            return execDirPath;
        }
        const snapshotPath = (0, node_path_1.resolve)(__dirname, '..', filePath);
        if ((0, node_fs_1.existsSync)(snapshotPath)) {
            return snapshotPath;
        }
    }
    return cwdPath;
};
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
const buildSwaggerConfig = (title, description) => new swagger_1.DocumentBuilder()
    .setTitle(title)
    .setDescription(description)
    .setVersion('1.0.0')
    .addBearerAuth({
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description: 'Paste access token as JWT (without Bearer prefix).',
}, 'access-token')
    .addServer('/')
    .build();
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
    const swaggerModuleDocs = swaggerDocs_1.swaggerModuleDocuments;
    app.enableShutdownHooks();
    app.use((0, express_1.json)({ limit: requestBodyLimit }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: requestBodyLimit }));
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: [`'self'`],
                styleSrc: [`'self'`, `'unsafe-inline'`],
                scriptSrc: [`'self'`, `'unsafe-inline'`],
                imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
                workerSrc: [`'self'`, 'blob:'],
                upgradeInsecureRequests: null,
            },
        },
    }));
    app.use(compression());
    const configuredCorsOrigins = parseCsv(process.env.CORS_ORIGINS);
    const corsOrigins = process.env.NODE_ENV === 'production'
        ? configuredCorsOrigins
        : Array.from(new Set([...configuredCorsOrigins, ...getDefaultDevCorsOrigins()]));
    const allowAnyCorsOrigin = corsOrigins.includes('*');
    const corsCredentialsDefault = allowAnyCorsOrigin ? false : true;
    const corsCredentials = parseBoolean(process.env.CORS_CREDENTIALS, corsCredentialsDefault);
    if (allowAnyCorsOrigin || corsOrigins.length > 0) {
        app.enableCors({
            origin: allowAnyCorsOrigin ? true : corsOrigins,
            credentials: corsCredentials,
        });
    }
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
        defaultVersion: process.env.API_VERSION ?? '1',
    });
    const rawApiPrefix = configService.get('app.apiPrefix', 'api');
    const apiPrefix = rawApiPrefix.replace(/^\/+|\/+$/g, '');
    if (apiPrefix) {
        app.setGlobalPrefix(apiPrefix);
    }
    const port = configService.get('app.port', 3000);
    const host = configService.get('app.host', '0.0.0.0');
    const allDocsPath = apiPrefix ? `${apiPrefix}/docs` : 'docs';
    const allSwaggerDocument = swagger_1.SwaggerModule.createDocument(app, buildSwaggerConfig('ERP Server API', 'API documentation for ERP Server'));
    const moduleNavList = swaggerModuleDocs.map((d) => ({
        label: d.title.replace(/ API$/, ''),
        url: `/${apiPrefix ? `${apiPrefix}/docs/${d.path}` : `docs/${d.path}`}`,
    }));
    const moduleSearchJs = `
(function () {
  var modules = ${JSON.stringify(moduleNavList)};
  function inject() {
    var topbar = document.querySelector('.topbar-wrapper');
    if (!topbar) { setTimeout(inject, 300); return; }
    if (document.getElementById('erp-module-search')) return;
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:flex;align-items:center;margin-left:16px;';
    var input = document.createElement('input');
    input.id = 'erp-module-search';
    input.type = 'text';
    input.placeholder = 'Search modules…';
    input.autocomplete = 'off';
    input.style.cssText = 'padding:6px 14px;border-radius:20px;border:none;font-size:13px;width:220px;outline:none;background:#fff;color:#333;box-shadow:0 1px 4px rgba(0,0,0,.25);';
    var dropdown = document.createElement('div');
    dropdown.style.cssText = 'position:absolute;top:calc(100% + 6px);left:0;width:260px;background:#fff;border:1px solid #ddd;border-radius:6px;max-height:320px;overflow-y:auto;z-index:9999;display:none;box-shadow:0 6px 16px rgba(0,0,0,.15);';
    function renderItems(val) {
      dropdown.innerHTML = '';
      var list = val ? modules.filter(function(m){ return m.label.toLowerCase().includes(val.toLowerCase()); }) : modules;
      if (!list.length) { dropdown.style.display='none'; return; }
      list.forEach(function(m) {
        var a = document.createElement('a');
        a.href = m.url;
        a.textContent = m.label;
        a.style.cssText = 'display:block;padding:9px 14px;color:#3b4151;text-decoration:none;font-size:13px;border-bottom:1px solid #f0f0f0;';
        a.addEventListener('mouseover', function(){ a.style.background='#f7f9fc'; });
        a.addEventListener('mouseout',  function(){ a.style.background=''; });
        dropdown.appendChild(a);
      });
      dropdown.style.display = 'block';
    }
    input.addEventListener('focus', function(){ renderItems(input.value); });
    input.addEventListener('input', function(){ renderItems(input.value); });
    document.addEventListener('click', function(e){ if (!wrapper.contains(e.target)){ dropdown.style.display='none'; } });
    wrapper.appendChild(input);
    wrapper.appendChild(dropdown);
    topbar.appendChild(wrapper);
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', inject); } else { inject(); }
})();
`;
    swagger_1.SwaggerModule.setup(allDocsPath, app, allSwaggerDocument, { customJsStr: moduleSearchJs });
    for (const docs of swaggerModuleDocs) {
        const docsPath = apiPrefix ? `${apiPrefix}/docs/${docs.path}` : `docs/${docs.path}`;
        const moduleSwaggerDocument = swagger_1.SwaggerModule.createDocument(app, buildSwaggerConfig(docs.title, docs.description), {
            include: docs.include,
        });
        swagger_1.SwaggerModule.setup(docsPath, app, moduleSwaggerDocument, { customJsStr: moduleSearchJs });
    }
    await app.listen(port, host);
    const appUrl = await app.getUrl();
    const docsUrl = buildAbsoluteUrl(appUrl, allDocsPath);
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
    for (const docs of swaggerModuleDocs) {
        const docsPath = apiPrefix ? `${apiPrefix}/docs/${docs.path}` : `docs/${docs.path}`;
        logger.log(`API docs URL (${docs.path}): ${buildAbsoluteUrl(appUrl, docsPath)}`, 'Bootstrap');
    }
    logger.log(`DB connected: ${isDbConnected}`, 'Bootstrap');
}
void bootstrap();
//# sourceMappingURL=main.js.map