import { type ClientPlatform } from '../../../common/client-info/client-info';
import type { CompatManifest } from '../compat/compat-manifest';
import type { UpdateBuildPolicyDto } from '../dto/build-policy.dto';
import { AppVersionStateStore, type BuildPolicy } from './app-version-state.store';
export declare class BuildPolicyService {
    private readonly store;
    private readonly logger;
    private policies;
    private readFailed;
    private inFlight;
    private generation;
    constructor(store: AppVersionStateStore);
    reload(): Promise<void>;
    list(): BuildPolicy[];
    get(platform: ClientPlatform): BuildPolicy | null;
    assertClientBuild(platform: ClientPlatform | null, clientBuild: number | null): void;
    update(platform: ClientPlatform, dto: UpdateBuildPolicyDto, actor: string): Promise<BuildPolicy>;
    useManifest(platform: ClientPlatform, manifest: CompatManifest | null, actor: string): Promise<BuildPolicy>;
    private remember;
    private read;
}
