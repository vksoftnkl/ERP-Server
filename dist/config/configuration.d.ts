declare const _default: () => {
    app: {
        nodeEnv: string;
        port: number;
        apiPrefix: string;
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
        ttl: number;
        limit: number;
    };
    auth: {
        jwtSecret: string;
        jwtExpiresIn: number;
    };
};
export default _default;
