// Dump tools/list of the local stdio server to JSON (used by the remote endpoint https://wimsta.com/mcp).
// Usage: node scripts/dump-tools.mjs <out.json>
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { writeFileSync, readFileSync } from 'node:fs';
const out = process.argv[2];
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const c = new Client({ name: 'dump-tools', version: '1' });
await c.connect(new StdioClientTransport({ command: process.execPath, args: [new URL('../index.js', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')] }));
const { tools } = await c.listTools();
writeFileSync(out, JSON.stringify({ version, tools }, null, 2) + '\n');
console.log(tools.length, 'tools ->', out);
await c.close();
