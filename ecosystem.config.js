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
        HTTPS_ENABLED: 'true',
        HTTPS_CERT_PATH: 'certs/localhost.crt',
        HTTPS_KEY_PATH: 'certs/localhost.key',
      },
    },
  ],
};