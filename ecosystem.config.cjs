// pm2 운영 설정: npm run build && pm2 start ecosystem.config.cjs && pm2 save
// 비밀값은 apps/web/.env (git 제외, 권한 600 — next start가 자동으로 읽음).
// 앱은 127.0.0.1:3400에만 바인딩되고 외부는 Caddy가 받는다 (deploy/Caddyfile.ebook-maker).
module.exports = {
  apps: [
    {
      name: 'ebook-maker',
      cwd: `${__dirname}/apps/web`,
      script: `${__dirname}/node_modules/next/dist/bin/next`,
      args: 'start -H 127.0.0.1 -p 3400',
      interpreter: 'node',
      node_args: '--disable-warning=ExperimentalWarning',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
  ],
};
