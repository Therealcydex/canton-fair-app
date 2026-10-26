// PM2 process file. On the server, from backend/:
//   pm2 start ecosystem.config.js     (first time)
//   pm2 reload sourcing-backend       (after a deployment)
//   pm2 save                          (start again after a reboot, with `pm2 startup`)
// One instance only: photos are stored on this server's disk (uploads/).
module.exports = {
  apps: [
    {
      name: 'sourcing-backend',
      script: 'index.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: { NODE_ENV: 'production' },
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
