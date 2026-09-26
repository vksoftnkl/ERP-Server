import { PrismaService } from '../../../database/prisma/prisma.service';
import { LookupModuleKey } from '../types/master-lookup-api.types';
import { ModuleFetcher } from '../types/master-lookup-internal.types';
export declare function buildModuleFetchers(prisma: PrismaService): Record<LookupModuleKey, ModuleFetcher>;
