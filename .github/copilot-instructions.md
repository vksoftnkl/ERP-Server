# AI Coding Agent Instructions for ERP Server

Enterprise-grade NestJS/PostgreSQL ERP system. This guide provides essential architectural knowledge for AI agents to be immediately productive.

## Architecture Overview

**Structure**: Modular NestJS monolith with domain-driven modules (accounting, inventory, admin).
- **Core**: [src/app.module.ts](../src/app.module.ts) imports 20+ feature modules
- **Modules**: [src/modules/](../src/modules/) - each self-contained with Controller → Service → Repository pattern
- **Database**: PostgreSQL via Prisma ORM with auto-generated schema composition
- **API**: Versioned (`/api/v1/*`) with global prefix and Swagger docs

**Key Integration Points**:
- `PrismaService` ([src/database/prisma/prisma.service.ts](../src/database/prisma/prisma.service.ts)) - singleton DI injectable
- `AuditLogModule` ([src/modules/audit-log/](../src/modules/audit-log/)) - imported by all data modules for change tracking
- Global filters/interceptors/pipes in [src/main.ts](../src/main.ts) - apply ValidationPipe, TimeoutInterceptor, AllExceptionsFilter

## Critical Developer Workflows

**Build & Start**:
```bash
npm install                              # postinstall runs prisma:schema:build + generate
npm run start:dev                        # watch mode (port 3010)
npm run build && npm run start:prod      # production
```

**Database & Migrations**:
```bash
npm run prisma:schema:build              # REQUIRED: builds merged schema from prisma/*.prisma files
npm run prisma:generate                  # generates @prisma/client types
npm run prisma:migrate:dev -- --name X   # create dev migration
npm run migration:run                    # deploy pending migrations
npm run prisma:studio                    # GUI explorer
```

**Testing**:
```bash
npm run test                             # unit tests (Jest)
npm run test:e2e                         # integration tests
npm run test:cov                         # coverage report
```

**Performance & Load Testing**:
```bash
npm run perf:smoke | perf:baseline | perf:stress | perf:custom
# See docs/performance-load-testing.md for routes configuration
```

## Project-Specific Conventions

### 1. Prisma Schema Organization
- **NEVER edit** `prisma/schema.prisma` directly - it's auto-generated
- **Edit only**: `prisma/base.prisma` (generator/datasource config) + `prisma/**/*.prisma` files
- Schema is merged by [scripts/build-prisma-schema.js](../scripts/build-prisma-schema.js) before generation
- Run `npm run prisma:schema:build` before `prisma generate` or migrations
- Multi-schema support: `"public", "grid", "audit", "purchase", "sales", "settings", "fixed", "accounts"`

### 2. Module Creation Pattern
All feature modules follow this structure:
```
src/modules/feature-name/
├── feature-name.module.ts           # @Module({ imports: [AuditLogModule], ... })
├── feature-name.controller.ts       # @Controller, @Post/Get/Patch/Delete routes
├── feature-name.service.ts          # @Injectable with Prisma business logic
├── feature-name-exception.filter.ts # Custom @Catch filter (optional, ItemGroup example)
├── dto/                             # class-validator + class-transformer
│   ├── save-*.dto.ts               # CreateUpdateDto with @ApiProperty decorators
│   ├── list-*-query.dto.ts         # Pagination/filtering (extends Query defaults)
│   └── *-response.dto.ts           # Response shapes for Swagger
├── entities/                        # Response entity types
├── types/                           # API response interfaces (success/error shapes)
└── *.spec.ts                        # Jest test files
```
**Example**: [src/modules/items-group-master/](../src/modules/items-group-master/) - reference pattern for CRUD + audit

### 3. DTO & Validation Pattern
- Use `class-validator` decorators: `@IsString()`, `@IsUUID()`, `@IsOptional()`, `@MaxLength()`, etc.
- Use `class-transformer` for input transformation: `@Transform()` (see [save-item-group.dto.ts#L15-L32](../src/modules/items-group-master/dto/save-item-group.dto.ts#L15-L32) for UUID/nullable handling)
- Add `@ApiProperty()` / `@ApiPropertyOptional()` for Swagger documentation
- Global `ValidationPipe` enforces: `whitelist: true, forbidNonWhitelisted: true, transform: true`

### 4. Service & Database Patterns
- **Inject** `PrismaService` in service constructor
- **Use** `Prisma.TransactionClient` for multi-operation transactions
- Services handle both CRUD and complex queries (see [items-group-master.service.ts#L200-350](../src/modules/items-group-master/items-group-master.service.ts#L200-350) for advanced filtering logic)
- **Audit integration**: Call `AuditLogService` for create/update/delete operations
- **Error handling**: Throw `BadRequestException`, `ConflictException`, `NotFoundException` (caught by global filter)

### 5. Exception Filtering & Response Format
- **Global filter**: [src/common/filters/all-exceptions.filter.ts](../src/common/filters/all-exceptions.filter.ts) - converts exceptions to consistent JSON
- **Module-level filter** (optional): Inherit and customize (see [item-group-exception.filter.ts](../src/modules/items-group-master/item-group-exception.filter.ts))
- Response format (success):
  ```ts
  { success: true, message: string, data: T, meta?: { ... } }
  ```
- Response format (error):
  ```ts
  { success: false, message: string, errors: { field?: string; message: string }[] }
  ```

### 6. Pagination & Grid Integration
- Query DTOs extend pagination: `page`, `limit`, `sort`, `search`
- Grid system ([src/modules/grid-columns/](../src/modules/grid-columns/), [grid-details/](../src/modules/grid-details/)) allows dynamic column filtering and SQL-based search
- Response meta includes: `{ total, page, limit, pageCount }`
- See [items-group-master.service.ts#L47-150](../src/modules/items-group-master/items-group-master.service.ts#L47-150) for pagination implementation

### 7. API Versioning & Routes
- Default version: `1` (URI-based: `/api/v1/*`)
- Controllers use `@Version('1')` decorator
- All routes protected by `@ApiBearerAuth('access-token')` and `AccessTokenGuard`
- Swagger path: `http://localhost:3010/api/docs`

## Configuration & Environment

**Key Env Variables** ([src/config/configuration.ts](../src/config/configuration.ts)):
- `DATABASE_URL` or components: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN` - auth tokens
- `THROTTLE_TTL=60`, `THROTTLE_LIMIT=100` - request rate limiting
- `HTTPS_ENABLED`, `HTTPS_CERT_PATH`, `HTTPS_KEY_PATH` - SSL config
- `LOG_FILE_PATH=logs/app.log`, `ERROR_LOG_FILE_PATH=logs/error.log`
- `.env.example` provided as template

**Validation**: Uses Joi schema ([src/config/env.validation.ts](../src/config/env.validation.ts))

## Cross-Component Communication

1. **Module Imports**: Import shared modules (e.g., `AuditLogModule` for audit tracking)
2. **Dependency Injection**: Inject services via constructor `constructor(private readonly service: ServiceName) {}`
3. **Database Transactions**: Use `prisma.$transaction()` for multi-operation atomicity
4. **Logging**: Inject `Logger` from `@nestjs/common` or use FileLoggerService
5. **Request Context**: [src/common/request-context/](../src/common/request-context/) provides request metadata (user, ID, etc.)

## Common Tasks & File Locations

| Task | Key Files |
|------|-----------|
| Add new CRUD module | Copy [items-group-master](../src/modules/items-group-master/) structure; register in [app.module.ts](../src/app.module.ts) |
| Add database model | Create `prisma/domain/model.prisma`, run `npm run prisma:schema:build` |
| Add auth endpoint | Modify [auth.module.ts](../src/modules/auth/auth.module.ts) + JWT guard logic |
| Global middleware | Register in [src/main.ts](../src/main.ts) `app.use()` |
| Add validation rule | Use class-validator decorators in DTOs |
| Debug DB queries | Set `DB_LOGGING=true` in `.env` |

## TypeScript Config

- **Target**: ES2022, CommonJS modules
- **Strict mode**: Enabled (`strict: true`)
- **Path aliases**: Not configured (use relative imports)
- **Decorators**: Enabled (required for NestJS/class-validator)

## Notes for AI Agents

- Always run `npm run prisma:schema:build` before Prisma operations
- Test new services with existing [items-group-master.service.ts](../src/modules/items-group-master/items-group-master.service.ts) as reference
- Respect the response format contract (success/error shapes) for client consistency
- Use AuditLogService for all write operations to maintain audit trail
- Leverage Prisma transactions for complex multi-table operations
