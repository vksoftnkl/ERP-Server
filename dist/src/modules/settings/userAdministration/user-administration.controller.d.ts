import { ResetUserPasswordDto, SaveUserAdministrationDto } from './dto/save-user-administration.dto';
import { UserAdministrationService } from './user-administration.service';
import { UserAdminPayload, UserAdminResetPasswordResult, UserAdminRestoreResult, UserAdminSuccessResponse, UserAdminUnlockResult } from './types/user-administration-api.types';
export declare class UserAdministrationController {
    private readonly userAdministrationService;
    constructor(userAdministrationService: UserAdministrationService);
    save(dto: SaveUserAdministrationDto): Promise<UserAdminSuccessResponse<UserAdminPayload>>;
    getById(usrId: string): Promise<UserAdminSuccessResponse<UserAdminPayload>>;
    remove(usrId: string): Promise<UserAdminSuccessResponse<{
        usrId: string;
        deleted: true;
    }>>;
    resetPassword(dto: ResetUserPasswordDto): Promise<UserAdminSuccessResponse<UserAdminResetPasswordResult>>;
    unlock(usrId: string): Promise<UserAdminSuccessResponse<UserAdminUnlockResult>>;
    restore(usrId: string): Promise<UserAdminSuccessResponse<UserAdminRestoreResult>>;
}
