import fs from 'fs';
const pyodideSrc = fs.readFileSync('node_modules/pyodide/pyodide.mjs', 'utf-8');
console.log("Found pyodide.mjs in node_modules!");
