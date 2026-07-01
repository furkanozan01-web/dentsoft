module.exports = {
  apps: [
    {
      name: 'dentsoft',
      script: 'node_modules/next/dist/bin/next',
      args: 'dev -p 3001',
      interpreter: 'node',
      windowsHide: true,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'development',
        CI: 'true',
        // Windows'ta Node.js, Supabase'in SSL sertifika zincirini doğrulayamıyor.
        // Geliştirme ortamında SSL doğrulamayı devre dışı bırak.
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
      },
    },
  ],
}
