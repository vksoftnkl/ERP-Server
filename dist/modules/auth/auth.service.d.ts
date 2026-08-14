import { UsersService } from '../users/users.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { TokenService } from './token.service';
export declare class AuthService {
    private readonly usersService;
    private readonly tokenService;
    constructor(usersService: UsersService, tokenService: TokenService);
    login(loginAuthDto: LoginAuthDto): Promise<LoginResponseDto>;
    private verifyPassword;
}
