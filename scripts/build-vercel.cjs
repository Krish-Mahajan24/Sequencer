const { cpSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const frontend = path.join(root, 'frontend');
const output = path.join(root, 'public');
mkdirSync(output, { recursive: true });
// Vercel serves only public/ through its CDN. Copy an explicit allowlisted
// frontend directory so backend source, environment files and tests stay private.
cpSync(frontend, output, { recursive: true });
cpSync(frontend, path.join(output, 'frontend'), { recursive: true });
console.log('Built static frontend at / and /frontend/ for Vercel.');
