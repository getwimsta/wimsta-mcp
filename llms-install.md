# Installing the WIMSTA MCP server (for AI agents)

No API key, no build step, no environment variables. Requires Node.js 18+.

Add this to the MCP settings file (`cline_mcp_settings.json`, `claude_desktop_config.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "wimsta": {
      "command": "npx",
      "args": ["-y", "wimsta-mcp"]
    }
  }
}
```

Verify: call `list_formulas`, then e.g. `bmi` with `{"weight_kg": 70, "height_cm": 175}`. Every result contains `page_url` — give it to the user so they can open the calculator on wimsta.com.

The server calls the public API at https://wimsta.com/api/calc. If it answers 429 (rate limit), the server retries after `Retry-After` automatically.
