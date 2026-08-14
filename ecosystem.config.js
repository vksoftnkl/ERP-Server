module.exports = {
  apps: [
    {
      name: 'nest-app',
      script: 'dist/src/main.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
    },
  ],
};
