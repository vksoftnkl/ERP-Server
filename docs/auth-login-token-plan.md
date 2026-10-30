# Auth Login + Token Return Plan

## Objective
Implement a login flow in the Auth module that validates user credentials and returns a signed JWT access token.

## Implementation Steps
1. **Create Auth DTOs**
   - Add `src/modules/auth/dto/login-auth.dto.ts`:
     - `user_name: string`
     - `user_password: string`
     - Add `class-validator` decorators.
   - Add `src/modules/auth/dto/login-response.dto.ts`:
     - `access_token: string`
     - `token_type: string` (use `Bearer`)
     - `user_id: string`

2. **Add JWT Environment Variables**
   - Update `.env.example`:
     - `JWT_SECRET=...`
   - Update `src/config/env.validation.ts`:
     - Validate `JWT_SECRET` (required in non-test environments).
   - Update `src/config/configuration.ts`:
     - Expose values under `auth` config.

3. **Wire AuthModule Dependencies**
   - Update `src/modules/auth/auth.module.ts`:
     - Import `UsersModule`.
     - Import and configure `JwtModule.registerAsync(...)` using `ConfigService`.
   - Ensure `AuthService` has access to:
     - `UsersService`
     - `JwtService`

4. **Implement Login Logic in AuthService**
   - Replace scaffold method in `src/modules/auth/auth.service.ts` with `login(...)`.
   - Flow:
     - Look up user by `user_name`.
     - Parse stored password format: `scrypt$<salt>$<hash>`.
     - Recompute hash from incoming password using same scrypt params.
     - Compare hashes safely.
     - Throw `UnauthorizedException` for invalid username/password.

5. **Sign and Return Access Token**
   - Build JWT payload with at least:
     - `sub: user_id`
     - `user_name`
   - Sign token with configured secret. Access tokens do not expire by time.
   - Return response:
     - `access_token`
     - `token_type: "Bearer"`
     - `user_id`

6. **Expose Login Endpoint in Controller**
   - Update `src/modules/auth/auth.controller.ts`:
     - Add `POST /auth/login`
     - Add `@Version('1')`
     - Add `@HttpCode(200)`
     - Accept `LoginAuthDto`
     - Return `LoginResponseDto`

7. **Add Swagger Documentation**
   - Add decorators on login endpoint:
     - `@ApiOperation`
     - `@ApiOkResponse({ type: LoginResponseDto })`
     - `@ApiUnauthorizedResponse`

8. **Add Tests**
   - Unit tests for `AuthService.login`:
     - Success case returns token.
     - Invalid username returns unauthorized.
     - Invalid password returns unauthorized.
   - E2E test:
     - `POST /api/v1/auth/login` returns `200` + token structure.

## Acceptance Criteria
- `POST /api/v1/auth/login` validates input and authenticates users.
- Invalid credentials return HTTP `401`.
- Valid credentials return JWT token payload and metadata.
- Config validation fails fast when JWT env vars are invalid.
- Unit and e2e tests pass for login flow.
