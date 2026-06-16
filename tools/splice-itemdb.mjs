import fs from 'node:fs';
const main = 'js/main.js';
let src = fs.readFileSync(main, 'utf8');
if (src.includes('iconKey: "wood"')) { console.log('SKIP: ITEM_DB already v2'); process.exit(0); }
const startMarker = 'window.ITEM_DB = {';
const start = src.indexOf(startMarker);
if (start < 0) { console.error('FAIL: ITEM_DB start not found'); process.exit(1); }
// find first '\n};\n' after start (end of object literal)
const end = src.indexOf('\n};\n', start);
if (end < 0) { console.error('FAIL: ITEM_DB end not found'); process.exit(1); }
const snippet = fs.readFileSync('tools/_itemdb.snippet', 'utf8').replace(/\n$/, '');
const before = src.slice(0, start);
const after = src.slice(end + 4); // skip '\n};\n'
const out = before + snippet + '\n' + after;
fs.writeFileSync(main, out, 'utf8');
console.log('OK: ITEM_DB replaced. file now', out.length, 'bytes');
