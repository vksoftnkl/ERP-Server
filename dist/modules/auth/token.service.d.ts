import { ConfigService } from '@nestjs/config';
type AccessTokenClaims = {
    sub: string;
    user_name: string;
};
export declare class TokenService {
    private readonly configService;
    private readonly secret;
    private readonly accessTokenLifetimeSeconds;
    constructor(configService: ConfigService);
    signAccessToken(claims: AccessTokenClaims): {
        token: string;
        expiresIn: number;
    };
    private encodeBase64Url;
}
export {};
