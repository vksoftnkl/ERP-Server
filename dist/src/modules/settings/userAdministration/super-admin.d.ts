import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
export declare function callerIsSuperAdmin(client: Prisma.TransactionClient | PrismaService, userId: string | null | undefined): Promise<boolean>;
