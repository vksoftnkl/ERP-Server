import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../../../database/prisma/prisma.service';
type RequestWithUser = Request & {
    user?: {
        sub?: unknown;
    };
};
export type AppVersionAccess = 'admin' | 'release';
export declare const APP_VERSION_ACCESS_KEY = "appVersionAccess";
export declare const ReleaseAccess: () => MethodDecorator;
export declare class AppVersionAdminGuard implements CanActivate {
    private readonly prisma;
    private readonly reflector;
    constructor(prisma: PrismaService, reflector: Reflector);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
export declare function actorOf(request: RequestWithUser): string;
export {};
