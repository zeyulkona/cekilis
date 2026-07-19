// Vercel serverless entry point: export the Express app directly, do not
// call app.listen() here (Vercel's Node runtime wraps this export itself).
module.exports = require('../src/app');
