// Local development entry point. On Vercel, api/index.js exports the same
// app (see src/app.js) as a serverless function instead of calling listen().
const app = require('./src/app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`cekilis dinleniyor: http://localhost:${PORT}`);
});
