module.exports = {
  apps: [
    {
      name: 'api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      // Keep retrying forever. The previous `max_restarts: 5` was paired with an
      // instant (no-delay) restart, so five boot failures burned in under a second
      // and PM2 parked the process in `errored` state permanently -- the platform
      // router then answers 502 until someone restarts it by hand. A boot failure
      // here is usually transient (the Postgres node still coming up after an
      // environment restart, a brief network blip), so the app must keep trying
      // rather than give up during the one minute the database is unavailable.
      autorestart: true,
      max_restarts: 50,
      // Back off 1s, 2s, 4s ... capped at 15s, instead of hot-looping. Without this
      // a crash-on-boot spins the CPU and floods the log.
      exponential_backoff_restart_delay: 1000,
      // Seeds run before the port opens (src/database/seed/startup-seed.ts), so a
      // cold start is legitimately slower than 10s and must not be judged unstable.
      min_uptime: '60s',
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
        // Reference data in prisma/seed is applied on every boot, before the port
        // opens (src/database/seed/startup-seed.ts). Every seed is idempotent, so a
        // restart re-runs them as a no-op, and a session advisory lock keeps two
        // instances from seeding at the same time. It defaults to on in production
        // anyway; pinned here so the behaviour is visible where the deploy is
        // configured. Set to 'false' to go back to seeding by hand.
        DB_AUTO_SEED: 'true',
        // Applies pending Prisma migrations (prisma migrate deploy) before the seeds.
        // Off by default: turn it on only if nothing else in the deploy applies
        // migrations -- with it off, deploy a schema change by running
        // `npm run prisma:migrate:deploy` on the node before restarting the app.
        DB_AUTO_MIGRATE: 'false',
        // A failing seed logs and startup continues, so bad reference data cannot
        // take the API down. Set to 'true' to make it a fatal startup error instead.
        DB_SEED_FAIL_FAST: 'false',
      },
    },
  ],
};