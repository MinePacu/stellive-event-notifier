const parsedConcurrency = Number.parseInt(process.env.WEB_CONCURRENCY ?? "2", 10);
const instances = Number.isInteger(parsedConcurrency) && parsedConcurrency > 0 ? parsedConcurrency : 2;

module.exports = {
  apps: [
    {
      name: "stellive-hub-api",
      script: "dist/backend/stellive-hub-api/src/index.js",
      instances,
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: "4000"
      },
      kill_timeout: 10000,
      listen_timeout: 10000,
      autorestart: true
    }
  ]
};
