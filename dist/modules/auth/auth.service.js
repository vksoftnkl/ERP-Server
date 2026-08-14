"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const node_util_1 = require("node:util");
const users_service_1 = require("../users/users.service");
const token_service_1 = require("./token.service");
const scryptAsync = (0, node_util_1.promisify)(node_crypto_1.scrypt);
let AuthService = class AuthService {
    usersService;
    tokenService;
    constructor(usersService, tokenService) {
        this.usersService = usersService;
        this.tokenService = tokenService;
    }
    async login(loginAuthDto) {
        const user = await this.usersService.findByUsername(loginAuthDto.user_name);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await this.verifyPassword(loginAuthDto.user_password, user.user_password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const { token, expiresIn } = this.tokenService.signAccessToken({
            sub: user.user_id,
            user_name: user.user_name,
        });
        return {
            access_token: token,
            token_type: 'Bearer',
            expires_in: expiresIn,
        };
    }
    async verifyPassword(plainPassword, storedPassword) {
        try {
            const [algorithm, salt, hashHex] = storedPassword.split('$');
            if (algorithm !== 'scrypt' || !salt || !hashHex) {
                return false;
            }
            const storedHashBuffer = Buffer.from(hashHex, 'hex');
            if (storedHashBuffer.length === 0) {
                return false;
            }
            const computedHashBuffer = (await scryptAsync(plainPassword, salt, storedHashBuffer.length));
            if (computedHashBuffer.length !== storedHashBuffer.length) {
                return false;
            }
            return (0, node_crypto_1.timingSafeEqual)(computedHashBuffer, storedHashBuffer);
        }
        catch {
            return false;
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        token_service_1.TokenService])
], AuthService);
//# sourceMappingURL=auth.service.js.map