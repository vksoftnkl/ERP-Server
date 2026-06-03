module.exports = {
  apps: [
    {
      name: 'nest-app',
      script: 'dist/src/main.js',
      cwd: '/home/vk/Dev/erp/ERP server',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3012,
      },
    },
  ],
};
