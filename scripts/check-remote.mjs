// Check a remote WIMSTA MCP endpoint with the official SDK client: node scripts/check-remote.mjs [url]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
const url = new URL(process.argv[2] || 'https://wimsta.com/mcp');
const c = new Client({ name: 'check-remote', version: '1' });
await c.connect(new StreamableHTTPClientTransport(url));
console.log('server:', JSON.stringify(c.getServerVersion()), 'protocol ok');
const { tools } = await c.listTools();
console.log('tools:', tools.length);
const r = await c.callTool({ name: 'tdee', arguments: { sex: 'female', age: 35, height_cm: 168, weight_kg: 65, activity: 'moderate' } });
console.log('tdee:', r.isError ? r.content[0].text : JSON.stringify(r.structuredContent.result).slice(0, 160));
const b = await c.callTool({ name: 'body_surface_area', arguments: { sex: 'male', height_cm: 180, weight_kg: 80 } });
console.log('bsa:', b.isError ? b.content[0].text : JSON.stringify(b.structuredContent.result).slice(0, 120));
await c.close();
