import { ConfigService } from '@nestjs/config';
export type AccessTokenClaims = {
    sub: string;
    user_name: string;
    sid: string;
    user_type: string | null;
    company_id: string | null;
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
    private compareSignatures;
    private validatePayload;
}
