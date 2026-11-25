#!/usr/bin/env node
// WIMSTA MCP server: evidence-based body calculators (BMI, body fat, BMR, TDEE,
// max heart rate, waist-to-height) and the open WIMSTA formula registry.
// Every number comes from the public WIMSTA Calculation API (https://wimsta.com/tools/#calculation-api),
// so results always match the calculators on wimsta.com. No API key, no tracking.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';

const BASE = (process.env.WIMSTA_BASE_URL || 'https://wimsta.com').replace(/\/$/, '');
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const UA = `wimsta-mcp/${version} (+https://github.com/getwimsta/wimsta-mcp)`;

async function call(path, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) qs.set(k, String(v));
  const url = `${BASE}${path}${qs.size ? `?${qs}` : ''}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (res.status === 429 && attempt < 2) {
      const wait = Math.min(Number(res.headers.get('retry-after')) || 1, 5);
      await new Promise((r) => setTimeout(r, wait * 1000 + 250));
      continue;
    }
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { error: text.slice(0, 300) }; }
    return { ok: res.ok, status: res.status, body };
  }
}

const asResult = ({ ok, status, body }) => ({
  isError: !ok,
  content: [{ type: 'text', text: ok ? JSON.stringify(body, null, 2) : `WIMSTA API error ${status}: ${body.error || JSON.stringify(body)}` }],
});

const sex = z.enum(['female', 'male']).describe('Biological sex used by the published equations');
const weight = z.number().min(20).max(350).describe('Body weight in kilograms');
const height = z.number().min(100).max(250).describe('Height in centimetres');
const age = z.number().int().min(18).max(100).describe('Age in years (adults only)');
const cm = (lo, hi, what) => z.number().min(lo).max(hi).optional().describe(`${what}, centimetres`);

const server = new McpServer({ name: 'wimsta', version });

const NOTE = ' Returns a range across several published formulas (not one number), the formulas used with links, and a medical disclaimer. Estimates, not diagnoses.';

server.registerTool('bmi', {
  title: 'BMI (range)',
  description: 'Body Mass Index as a range: classic Quetelet BMI and Trefethen "new BMI", with the WHO category.' + NOTE,
  inputSchema: { weight_kg: weight, height_cm: height },
}, async (a) => asResult(await call('/api/calc/bmi', a)));

server.registerTool('body_fat', {
  title: 'Body fat % (range)',
  description: 'Body-fat percentage as a range across every validated formula the given measurements allow (Deurenberg, CUN-BAE, US Navy, RFM, Covert Bailey), with the Gallagher category. Give as many optional measurements as you have.' + NOTE,
  inputSchema: {
    sex, height_cm: height,
    weight_kg: weight.optional(), age: age.optional(),
    waist_cm: cm(45, 160, 'Natural waist'),
    abdomen_cm: cm(50, 170, 'Abdomen at the navel (US Navy, men)'),
    neck_cm: cm(20, 60, 'Neck'), hip_cm: cm(60, 180, 'Hips'),
    wrist_cm: cm(10, 25, 'Wrist'), forearm_cm: cm(15, 45, 'Forearm'),
    thigh_cm: cm(30, 90, 'Thigh'), calf_cm: cm(20, 60, 'Calf'),
  },
}, async (a) => asResult(await call('/api/calc/body-fat', a)));

const bmrShape = {
  sex, weight_kg: weight, height_cm: height, age,
  body_fat_pct: z.number().min(3).max(65).optional().describe('Body-fat %, if known (adds Katch–McArdle)'),
};

server.registerTool('bmr', {
  title: 'Basal metabolic rate (range)',
  description: 'Basal metabolic rate in kcal/day as a range: Mifflin–St Jeor, Harris–Benedict 1984 and 1919, WHO/FAO, plus Katch–McArdle when body-fat % is given.' + NOTE,
  inputSchema: bmrShape,
}, async (a) => asResult(await call('/api/calc/bmr', a)));

server.registerTool('tdee', {
  title: 'Daily calorie needs / TDEE (range)',
  description: 'Total daily energy expenditure (maintenance calories, kcal/day) = the BMR range × an activity multiplier.' + NOTE,
  inputSchema: {
    ...bmrShape,
    activity: z.enum(['sedentary', 'light', 'moderate', 'extra', 'extreme']).describe('Activity level'),
  },
}, async (a) => asResult(await call('/api/calc/tdee', a)));

server.registerTool('max_heart_rate', {
  title: 'Maximum heart rate and training zones',
  description: 'Maximum heart rate (bpm) as a range across nine published formulas (Fox, Tanaka, Gulati, Gellish, Nes and others) plus five training zones.' + NOTE,
  inputSchema: { age, sex: sex.optional() },
}, async (a) => asResult(await call('/api/calc/max-heart-rate', a)));

server.registerTool('waist_to_height', {
  title: 'Waist-to-height ratio',
  description: 'Waist-to-height ratio (a measurement, not an estimate) with the Ashwell zone and the healthy waist range for the given height. Includes a medical disclaimer.',
  inputSchema: { waist_cm: z.number().min(45).max(160).describe('Natural waist, centimetres'), height_cm: height },
}, async (a) => asResult(await call('/api/calc/waist-to-height', a)));

server.registerTool('get_formula', {
  title: 'Look up a formula in the WIMSTA registry',
  description: 'Get one formula from the open WIMSTA formula registry (CC BY 4.0): equation, original study citation, population it was validated on, known limitations. Call list_formulas first to find ids.',
  inputSchema: { id: z.string().min(1).describe('Formula id, e.g. "cun-bae", "tanaka", "harris-benedict-1984"') },
}, async ({ id }) => asResult(await call('/api/formulas', { id })));

server.registerTool('list_formulas', {
  title: 'List formulas in the WIMSTA registry',
  description: 'List the formulas in the open WIMSTA formula registry (CC BY 4.0), optionally filtered by category. Without a category returns the index of ids and categories.',
  inputSchema: { category: z.string().optional().describe('Category to filter by, one of body-fat, body-fat-ranges, bmi, waist-to-height, max-heart-rate, bmr; omit for the full index') },
}, async ({ category }) => asResult(await call('/api/formulas', { category })));

await server.connect(new StdioServerTransport());
