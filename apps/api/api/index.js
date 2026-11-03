let serverlessModule;
try {
  serverlessModule = require('../dist/src/serverless');
} catch (e) {
  serverlessModule = require('../dist/serverless');
}

const { bootstrapServerless } = serverlessModule;

module.exports = async (req, res) => {
  const app = await bootstrapServerless();

  // If Vercel rewrote the destination to index.js, recover original request path
  if (req.url === '/api/index.js' || req.url === '/api' || req.url === '/api/') {
    const matched = req.headers['x-matched-path'] || req.headers['x-now-route-matches'];
    if (matched && matched !== '/api/index.js') {
      req.url = matched;
    }
  }

  return app(req, res);
};
