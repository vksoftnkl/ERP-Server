import { Prisma } from '@prisma/client';
import { LoadingSlabRow } from '../types/master-lookup-internal.types';
export declare function resolveLoadingWeight(uomWeight: Prisma.Decimal | number): Prisma.Decimal | null;
export declare function selectLoadingSlab<T extends LoadingSlabRow>(slabs: T[], companyId: string, branchId: string): T | null;
