# WIMSTA MCP server

[![npm](https://img.shields.io/npm/v/wimsta-mcp)](https://www.npmjs.com/package/wimsta-mcp) [![getwimsta/wimsta-mcp MCP server](https://glama.ai/mcp/servers/getwimsta/wimsta-mcp/badges/score.svg)](https://glama.ai/mcp/servers/getwimsta/wimsta-mcp)

Evidence-based body calculators for AI assistants. Ask Claude, Cursor or any
[MCP](https://modelcontextprotocol.io) client for your BMI, body-fat %, calorie needs or max heart
rate and get **a range across published formulas, not one made-up number**, with the formulas,
their original studies and a medical disclaimer.

Results come from the public [WIMSTA Calculation API](https://wimsta.com/tools/#calculation-api),
so they always match the calculators on [wimsta.com](https://wimsta.com). No API key, no account, no tracking.

## Tools

| Tool | What it returns |
|---|---|
| `bmi` | BMI range: classic Quetelet + Trefethen "new BMI", WHO category |
| `body_fat` | Body-fat % range across Deurenberg, CUN-BAE, US Navy, RFM, Covert Bailey (whatever your measurements allow), Gallagher category |
| `bmr` | Basal metabolic rate range: Mifflin–St Jeor, Harris–Benedict 1984/1919, WHO/FAO, Katch–McArdle |
| `tdee` | Maintenance calories (TDEE) range for an activity level |
| `max_heart_rate` | Max heart rate range across nine formulas + five training zones |
| `waist_to_height` | Waist-to-height ratio, Ashwell zone, healthy waist range |
| `ideal_weight` | Ideal body weight range across seven classic formulas + WHO healthy-weight range |
| `ffmi` | Fat-Free Mass Index, raw and normalized, neutral band |
| `body_surface_area` | Body surface area range across eight formulas |
| `body_shape` | Body-shape type from bust, waist and hip ratios |
| `body_frame` | Body-frame size from the height ÷ wrist ratio |
| `protein` | Daily protein bands (RDA, active, preservation, lean-mass) |
| `water` | Daily water range across five authorities, lifestyle add-ons |
| `creatine` | Creatine maintenance and loading dose (ISSN) |
| `one_rep_max` | One-rep max range across Epley, Brzycki, Lombardi, Lander + training table |
| `vo2max` | VO2max range from Uth, Cooper and Rockport field tests |
| `running_pace` | Pace / time / distance solver + Riegel race prediction range |
| `get_formula` | One formula from the open [WIMSTA formula registry](https://wimsta.com/registry/) (CC BY 4.0): equation, citation, validation population, limitations |
| `list_formulas` | Registry index, or all formulas of a category |

Metric units (kg, cm), adults 18–100.

## Install

Claude Desktop / Claude Code / Cursor (`mcpServers` config):

```json
{
  "mcpServers": {
    "wimsta": { "command": "npx", "args": ["-y", "wimsta-mcp"] }
  }
}
```

Claude Code: `claude mcp add wimsta -- npx -y wimsta-mcp`

Requires Node.js 18+.

## Example

> "I'm a 35-year-old woman, 168 cm, 65 kg, moderately active. How many calories do I burn a day?"

The assistant calls `tdee` and answers with a range (about 2,100–2,200 kcal/day), names the
formulas behind it and links to each one.

## Why ranges

Every body-composition and energy formula was fitted on a particular population and carries an
error of several percent. Showing the spread between validated equations is more honest than
picking one. See the [WIMSTA methodology](https://wimsta.com/registry/).

## Disclaimer

Estimates, not diagnoses. These tools are for general information and are not a substitute for
professional medical advice. Talk to a doctor before acting on any result.

## License

Code: MIT. Formula registry data: CC BY 4.0, cite as "WIMSTA (wimsta.com)".
