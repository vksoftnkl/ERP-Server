import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { UserType } from './types/user-administration.enum';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Notes 125 §3 — is the caller VK Softwares' own SUPER ADMIN? Read from
 * user_master, never from the token's `user_type` claim: a role taken away
 * stops counting at once, not when the token expires. An unknown, inactive or
 * deleted caller is not one.
 */
export async function callerIsSuperAdmin(
  client: Prisma.TransactionClient | PrismaService,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!userId || !UUID.test(userId)) {
    return false;
  }
  const user = await client.userMaster.findFirst({
    where: { usrId: userId, usrIsActive: true, usrIsDeleted: false },
    select: { usrType: true },
  });
  return user?.usrType === UserType.SUPER_ADMIN;
}
