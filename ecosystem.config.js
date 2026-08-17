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
        PORT: 8080,
        // TLS is terminated by the platform load balancer, so the app serves plain
        // HTTP on PORT. Pinned here (not left to .env) because dotenv does not
        // override values already present in process.env.
        HTTPS_ENABLED: 'false',
      },
    },
  ],
};