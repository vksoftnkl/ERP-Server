declare const _default: () => {
    app: {
        nodeEnv: string;
        host: string;
        port: number;
        apiPrefix: string;
        apiVersion: string;
        requestBodyLimit: string;
        logFilePath: string;
        errorLogFilePath: string;
        https: {
            enabled: boolean;
            certPath: string;
            keyPath: string;
            passphrase: string;
        };
    };
    database: {
        url: string;
        readOnlyUrl: string;
        host: string;
        port: number;
        username: string;
        password: string;
        name: string;
        ssl: boolean;
        synchronize: boolean;
        logging: boolean;
    };
    throttler: {
        enabled: boolean;
        ttl: number;
        limit: number;
    };
    auth: {
        jwtSecret: string;
        accessTokenTtlSeconds: number;
        refreshTokenTtlSeconds: number;
    };
    redis: {
        enabled: boolean;
        host: string;
        port: number;
        ttl: number;
        username: string;
        password: string;
        db: number;
        tls: boolean;
        connectTimeoutMs: number;
    };
};
export default _default;
