import { AuthModule } from '../modules/auth/auth.module';
import { AppVersionModule } from '../modules/app-version/app-version.module';
export declare const swaggerModuleDocuments: ({
    path: string;
    title: string;
    description: string;
    include: (typeof AuthModule)[];
} | {
    path: string;
    title: string;
    description: string;
    include: (typeof AppVersionModule)[];
})[];
