import {
  applyDecorators,
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { clientInfoOf } from '../../common/client-info/client-info';
import { API_VERSION } from '../../common/constants/api-version';
import { Public } from '../../common/decorators/public.decorator';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import {
  BuildPolicyResponseDto,
  PolicyPlatformParamsDto,
  UpdateBuildPolicyDto,
} from './dto/build-policy.dto';
import { AppUpdateInfoDto, CheckUpdateQueryDto } from './dto/check-update.dto';
import {
  CreateReleaseDto,
  ListReleasesQueryDto,
  ReleaseKeyParamsDto,
  ReleaseResponseDto,
  UpdateReleaseDto,
} from './dto/release.dto';
import {
  InstallationSummaryQueryDto,
  LegacyUsageQueryDto,
  ListInstallationsQueryDto,
} from './dto/support-query.dto';
import { actorOf, AppVersionAdminGuard, ReleaseAccess } from './guards/app-version-admin.guard';
import { AppUpdateService } from './services/app-update.service';
import type { BuildPolicy } from './services/app-version-state.store';
import { BackendUpdateService } from './services/backend-update.service';
import { BuildPolicyService } from './services/build-policy.service';
import {
  ClientInstallationService,
  type InstallationRow,
  type PlatformInstallationSummary,
} from './services/client-installation.service';
import { LegacyUsageService, type LegacyUsageRow } from './services/legacy-usage.service';
import { AppVersionErrorCode, appVersionErrorBody } from './types/app-version-error-codes';

/**
 * A release / policy / support route (Rev 2, decision D5): a JWT (the global
 * AccessTokenGuard, 401) of an ADMIN or SUPER ADMIN user (AppVersionAdminGuard, 403).
 */
const AdminRoute = (): MethodDecorator =>
  applyDecorators(
    UseGuards(AppVersionAdminGuard),
    ApiBearerAuth('access-token'),
    ApiUnauthorizedResponse({ type: HttpErrorResponseDto, description: 'No or a dead token' }),
    ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'APP_VERSION_ADMIN_ONLY' }),
  );

/** Step 4 (E5): a route the CI user (RELEASE MANAGER) may call too, besides the admins. */
const ReleaseRoute = (): MethodDecorator => applyDecorators(AdminRoute(), ReleaseAccess());

/**
 * Part B Step 2: version tracking, the update notice, and (Rev 2) the
 * enforced build policy.
 *
 * Only /check is public: it must answer before login and is never blocked by
 * the build check. Every other route needs a signed-in ADMIN / SUPER ADMIN;
 * the release list and release registration also take a RELEASE MANAGER (the
 * CI user, Step 4 E5). The X-Ops-Key of the first version is gone. Writes stamp the user's id into
 * *_created_by / *_modified_by.
 */
@ApiTags('App Version')
@Controller('app-version')
export class AppVersionController {
  constructor(
    private readonly updates: AppUpdateService,
    private readonly installations: ClientInstallationService,
    private readonly legacyUsage: LegacyUsageService,
    private readonly policies: BuildPolicyService,
    private readonly backendUpdate: BackendUpdateService,
  ) {}

  @Public()
  @Get('check')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Is a newer build available? (public, read-only)',
    description:
      'platform and build come from the query, else from the X-App-Platform / X-App-Build headers.',
  })
  @ApiOkResponse({ type: AppUpdateInfoDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  check(@Query() query: CheckUpdateQueryDto, @Req() request: Request): Promise<AppUpdateInfoDto> {
    const client = clientInfoOf(request);
    const platform = query.platform ?? client.platform;
    const build = query.build ?? client.build;
    if (!platform) {
      throw new BadRequestException(
        appVersionErrorBody(
          'platform is required (?platform= or the X-App-Platform header)',
          'platform',
          AppVersionErrorCode.PLATFORM_REQUIRED,
        ),
      );
    }
    if (build === null || build === undefined) {
      throw new BadRequestException(
        appVersionErrorBody(
          'build is required (?build= or the X-App-Build header)',
          'build',
          AppVersionErrorCode.BUILD_REQUIRED,
        ),
      );
    }
    return this.updates.check(platform, build);
  }

  @Post('releases')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.CREATED)
  @ReleaseRoute()
  @ApiOperation({
    summary:
      'Register a released build (CI user or admin); setExpected also makes it the expected build',
  })
  @ApiCreatedResponse({ type: ReleaseResponseDto })
  @ApiConflictResponse({
    type: HttpErrorResponseDto,
    description: 'APP_RELEASE_BUILD_EXISTS | APP_RELEASE_BUILD_TOO_LOW',
  })
  createRelease(
    @Body() dto: CreateReleaseDto,
    @Req() request: Request,
  ): Promise<ReleaseResponseDto> {
    return this.updates.createRelease(dto, actorOf(request));
  }

  @Patch('releases/:platform/:build')
  @Version(API_VERSION)
  @AdminRoute()
  @ApiOperation({ summary: 'Change a release: severity, notes, link; isDeleted:true yanks it' })
  @ApiOkResponse({ type: ReleaseResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto, description: 'APP_RELEASE_NOT_FOUND' })
  updateRelease(
    @Param() params: ReleaseKeyParamsDto,
    @Body() dto: UpdateReleaseDto,
    @Req() request: Request,
  ): Promise<ReleaseResponseDto> {
    return this.updates.updateRelease(params.platform, params.build, dto, actorOf(request));
  }

  @Get('releases')
  @Version(API_VERSION)
  @ReleaseRoute()
  @ApiOperation({
    summary: 'Live releases, newest build first; includeDeleted=true adds yanked ones (CI)',
  })
  @ApiOkResponse({ type: ReleaseResponseDto, isArray: true })
  listReleases(@Query() query: ListReleasesQueryDto): Promise<ReleaseResponseDto[]> {
    return this.updates.listReleases(query.platform, query.includeDeleted === true);
  }

  @Get('installations')
  @Version(API_VERSION)
  @AdminRoute()
  @ApiOperation({ summary: 'Which user / device runs which build, last seen first (support)' })
  listInstallations(
    @Query() query: ListInstallationsQueryDto,
  ): Promise<{ total: number; rows: InstallationRow[] }> {
    return this.installations.list(query);
  }

  @Get('installations/summary')
  @Version(API_VERSION)
  @AdminRoute()
  @ApiOperation({
    summary: 'Per platform: builds in use, the oldest active build, how many are behind (support)',
  })
  installationSummary(
    @Query() query: InstallationSummaryQueryDto,
  ): Promise<PlatformInstallationSummary[]> {
    return this.installations.summary(query);
  }

  @Get('legacy-usage')
  @Version(API_VERSION)
  @AdminRoute()
  @ApiOperation({ summary: 'How often each legacy field is still used, per build (support)' })
  legacyUsageList(@Query() query: LegacyUsageQueryDto): Promise<LegacyUsageRow[]> {
    return this.legacyUsage.list(query);
  }

  @Get('policy')
  @Version(API_VERSION)
  @AdminRoute()
  @ApiOperation({ summary: 'The build policy of every platform (Rev 2 §5.4)' })
  @ApiOkResponse({ type: BuildPolicyResponseDto, isArray: true })
  listPolicies(): BuildPolicyResponseDto[] {
    return this.policies.list().map(toPolicyResponse);
  }

  @Patch('policy/:platform')
  @Version(API_VERSION)
  @AdminRoute()
  @ApiOperation({
    summary:
      "Change a platform's build policy; the row becomes manual (enforce:false = emergency switch)",
  })
  @ApiOkResponse({ type: BuildPolicyResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: 'APP_POLICY_BUILD_REQUIRED' })
  async updatePolicy(
    @Param() params: PolicyPlatformParamsDto,
    @Body() dto: UpdateBuildPolicyDto,
    @Req() request: Request,
  ): Promise<BuildPolicyResponseDto> {
    return toPolicyResponse(await this.policies.update(params.platform, dto, actorOf(request)));
  }

  @Post('policy/:platform/use-manifest')
  @Version(API_VERSION)
  @HttpCode(HttpStatus.OK)
  @AdminRoute()
  @ApiOperation({
    summary: 'Hand a platform back to the bundled compat manifest (its values, source manifest)',
  })
  @ApiOkResponse({ type: BuildPolicyResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto, description: 'APP_POLICY_NO_MANIFEST' })
  async usePolicyManifest(
    @Param() params: PolicyPlatformParamsDto,
    @Req() request: Request,
  ): Promise<BuildPolicyResponseDto> {
    return toPolicyResponse(
      await this.policies.useManifest(
        params.platform,
        this.backendUpdate.bundledManifest(),
        actorOf(request),
      ),
    );
  }
}

function toPolicyResponse(policy: BuildPolicy): BuildPolicyResponseDto {
  return {
    platform: policy.platform,
    enforce: policy.enforce,
    expectedBuild: policy.expectedBuild,
    message: policy.message,
    downloadUrl: policy.downloadUrl,
    source: policy.source,
    changedOn: policy.changedOn ? policy.changedOn.toISOString() : null,
    changedBy: policy.changedBy,
  };
}
