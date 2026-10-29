// Vercel's Express entry point; local development still uses backend/server.js.
const express = require('express');
const app = express();
app.use(require('./backend/server'));
module.exports = app;
