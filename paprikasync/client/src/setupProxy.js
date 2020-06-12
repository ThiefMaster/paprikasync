const proxy = require('http-proxy-middleware');

module.exports = app => {
  const config = {target: process.env.FLASK_URL || 'http://127.0.0.1:5000'};
  app.use(proxy('/api/', config));
  app.use(proxy('/image/', config));
};
