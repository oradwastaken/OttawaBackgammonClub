// Generates data.js from data.json for file:// protocol fallback
// Usage: node scripts/generate-data-js.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const json = fs.readFileSync(path.join(root, 'data.json'), 'utf8');
fs.writeFileSync(path.join(root, 'data.js'), 'window.__BACKGAMMON_DATA__ = ' + json + ';\n');
console.log('Generated data.js from data.json');
