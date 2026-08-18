module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      max_restarts: 5,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        // 3000 is the only application port the Jelastic Node.js layer whitelists in
        // /etc/jelastic/jelastic.nft (the INPUT chain ends in a reject, and NAT
        // PREROUTING is empty, so there is no 80 -> app redirect). Binding 8080 makes
        // the app healthy inside the container but unreachable through the platform
        // router, which answers 502. It is also unprivileged, so the container user
        // can bind it.
        PORT: 3000,
        // TLS is terminated by the platform load balancer, so the app serves plain
        // HTTP on PORT. Pinned here (not left to .env) because dotenv does not
        // override values already present in process.env.
        HTTPS_ENABLED: 'false',
        // No Redis node exists in the Jelastic topology, so REDIS_HOST's default of
        // localhost:6379 is unreachable there. Left enabled, every cached GET logs a
        // failed lookup (requests still succeed, HttpCacheInterceptor swallows it) and
        // /api/v1/health reports cache "down" -> 503, marking the app unhealthy to any
        // probe. Health treats "disabled" as OK, so pin this off until a real Redis
        // node is provisioned, then set REDIS_HOST to it and flip this back.
        REDIS_ENABLED: 'false',
        // Browser origins allowed to call this API. In production main.ts uses only
        // this list (the dev-default localhost origins are not merged in), so an unset
        // value means enableCors() is never called and every browser request is blocked.
        // The hashed *-7rixsf5qd-* entry is a single Vercel deployment and is replaced
        // on every redeploy; erp-frontend.vercel.app is the stable production alias and
        // is the one worth relying on.
        CORS_ORIGINS: [
          'https://erp-frontend.vercel.app',
          'https://erp-frontend-vksoftnkls-projects.vercel.app',
          'https://erp-frontend-7rixsf5qd-vksoftnkls-projects.vercel.app',
          'https://vknexttimber-front.cloudjiffy.net',
          'https://localhost:3001',
          'https://192.168.0.106:3001',
        ].join(','),
        // Explicit origins (not '*'), so credentialed requests are allowed.
        CORS_CREDENTIALS: 'true',
      },
    },
  ],
};