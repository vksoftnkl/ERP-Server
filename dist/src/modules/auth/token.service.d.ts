import { ConfigService } from '@nestjs/config';
import { type ClientPlatform } from '../../common/client-info/client-info';
export type AccessTokenClaims = {
    sub: string;
    user_name: string;
    sid: string;
    user_type: string | null;
    company_id: string | null;
    branch_id: string | null;
    device_id: string | null;
    ep?: number;
    platform?: ClientPlatform | null;
};
export type AccessTokenPayload = AccessTokenClaims & {
    iat: number;
    exp: number;
    typ: 'access';
};
export type RefreshTokenPayload = AccessTokenClaims & {
    iat: number;
    exp: number;
    typ: 'refresh';
};
export type SignedAccessToken = {
    token: string;
    payload: AccessTokenPayload;
};
export type SignedRefreshToken = {
    token: string;
    payload: RefreshTokenPayload;
};
export declare class TokenService {
    private readonly configService;
    private readonly secret;
    private readonly accessTokenTtlSeconds;
    private readonly refreshTokenTtlSeconds;
    constructor(configService: ConfigService);
    signAccessToken(claims: AccessTokenClaims): SignedAccessToken;
    signRefreshToken(claims: AccessTokenClaims): SignedRefreshToken;
    private signToken;
    verifyAccessToken(token: string): AccessTokenPayload;
    verifyRefreshToken(token: string): RefreshTokenPayload;
    private verifyToken;
    private encodeBase64Url;
    private decodeSegment;
    private invalidToken;
    private expiredToken;
    private compareSignatures;
    private validatePayload;
}
