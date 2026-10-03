// PM2 config for the VPS at 169.58.213.171.
//
// Deliberately lives at /opt/erp-server/ecosystem.config.js -- OUTSIDE the git
// working tree at /opt/erp-server/app -- so that the `git reset --hard` in
// deploy.sh cannot overwrite it. The repo's own ecosystem.config.js is for the
// CloudJiffy/Jelastic topology and is unused here.
//
// `env` is intentionally left empty. src/env.preload.ts runs dotenv.config()
// before anything else, and dotenv does NOT override variables already present
// in process.env -- so anything pinned here would silently win over
// /opt/erp-server/app/.env. Keeping this empty makes .env the single source of
// truth for configuration.
module.exports = {
  apps: [
    {
      name: 'erp-api',
      script: 'dist/src/main.js',
      cwd: '/opt/erp-server/app', // dotenv resolves .env relative to CWD.
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '1G',

      autorestart: true,
      max_restarts: 50,
      // Back off 1s, 2s, 4s ... capped at 15s. Without this, a crash-on-boot
      // hot-loops the CPU and floods the log.
      exponential_backoff_restart_delay: 1000,
      // Seeds run before the port opens (src/database/seed/startup-seed.ts), so
      // a cold start is legitimately slower than PM2's 1s default and must not
      // be judged unstable.
      min_uptime: '60s',
      kill_timeout: 10000,

      error_file: '/opt/erp-server/logs/pm2-error.log',
      out_file: '/opt/erp-server/logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
