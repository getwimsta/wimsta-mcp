#!/usr/bin/env node
// WIMSTA MCP server: 17 evidence-based body and fitness calculators (BMI, body fat, BMR, TDEE,
// ideal weight, protein, water, max heart rate, VO2max, one-rep max, running pace…) and the open WIMSTA formula registry.
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

const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const server = new McpServer({ name: 'wimsta', version });

const NOTE = ' Returns a range across several published formulas (not one number), the formulas used with links, page_url (the matching calculator page on wimsta.com, worth sharing with the user), and a medical disclaimer. Estimates, not diagnoses.';

server.registerTool('bmi', {
  title: 'BMI (range)',
  annotations: { title: 'BMI (range)', ...RO },
  description: 'Body Mass Index as a range: classic Quetelet BMI and Trefethen "new BMI", with the WHO category.' + NOTE,
  inputSchema: { weight_kg: weight, height_cm: height },
}, async (a) => asResult(await call('/api/calc/bmi', a)));

server.registerTool('body_fat', {
  title: 'Body fat % (range)',
  annotations: { title: 'Body fat % (range)', ...RO },
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
  annotations: { title: 'Basal metabolic rate (range)', ...RO },
  description: 'Basal metabolic rate in kcal/day as a range: Mifflin–St Jeor, Harris–Benedict 1984 and 1919, WHO/FAO, plus Katch–McArdle when body-fat % is given.' + NOTE,
  inputSchema: bmrShape,
}, async (a) => asResult(await call('/api/calc/bmr', a)));

server.registerTool('tdee', {
  title: 'Daily calorie needs / TDEE (range)',
  annotations: { title: 'Daily calorie needs / TDEE (range)', ...RO },
  description: 'Total daily energy expenditure (maintenance calories, kcal/day) = the BMR range × an activity multiplier.' + NOTE,
  inputSchema: {
    ...bmrShape,
    activity: z.enum(['sedentary', 'light', 'moderate', 'extra', 'extreme']).describe('Activity level'),
  },
}, async (a) => asResult(await call('/api/calc/tdee', a)));

server.registerTool('max_heart_rate', {
  title: 'Maximum heart rate and training zones',
  annotations: { title: 'Maximum heart rate and training zones', ...RO },
  description: 'Maximum heart rate (bpm) as a range across nine published formulas (Fox, Tanaka, Gulati, Gellish, Nes and others) plus five training zones.' + NOTE,
  inputSchema: { age, sex: sex.optional() },
}, async (a) => asResult(await call('/api/calc/max-heart-rate', a)));

server.registerTool('waist_to_height', {
  title: 'Waist-to-height ratio',
  annotations: { title: 'Waist-to-height ratio', ...RO },
  description: 'Waist-to-height ratio (a measurement, not an estimate) with the Ashwell zone and the healthy waist range for the given height. Includes a medical disclaimer.',
  inputSchema: { waist_cm: z.number().min(45).max(160).describe('Natural waist, centimetres'), height_cm: height },
}, async (a) => asResult(await call('/api/calc/waist-to-height', a)));

const bf = z.number().min(3).max(65).describe('Body-fat %');
const tool = (name, title, description, inputSchema, path) =>
  server.registerTool(name, { title, description, inputSchema, annotations: { title, ...RO } }, async (a) => asResult(await call(path, a)));

tool('ideal_weight', 'Ideal body weight (range)',
  'Ideal body weight as a range across seven classic formulas (Hamwi, Devine, Robinson, Miller, Broca, Lorentz, Peterson) plus the WHO healthy-weight range for the height.' + NOTE,
  { sex, height_cm: height }, '/api/calc/ideal-weight');

tool('ffmi', 'Fat-Free Mass Index',
  'Fat-Free Mass Index (lean mass for height), raw and normalized to 1.8 m, with a neutral descriptive band. Needs body-fat %.' + NOTE,
  { sex, weight_kg: weight, height_cm: height, body_fat_pct: bf }, '/api/calc/ffmi');

tool('body_surface_area', 'Body surface area (range)',
  'Body surface area in m² as a range across eight formulas (Mosteller, Du Bois, Haycock, Gehan–George, Boyd, Fujimoto, Takahira, Schlich).' + NOTE,
  { sex, weight_kg: weight, height_cm: height }, '/api/calc/bsa');

tool('body_shape', 'Body shape type',
  'Body-shape type (hourglass, pear, inverted triangle, rectangle, apple) from bust/chest, waist and hip ratios. A descriptive label, not a health verdict.',
  { bust_cm: z.number().min(60).max(160).describe('Bust (chest for men), centimetres'), waist_cm: z.number().min(45).max(160).describe('Natural waist, centimetres'), hip_cm: z.number().min(60).max(180).describe('Hips, centimetres') },
  '/api/calc/body-shape');

tool('body_frame', 'Body frame size',
  'Body-frame size (small / medium / large) from the height ÷ wrist ratio (Grant cut points). A rule of thumb, not a clinical measure.',
  { sex, height_cm: height, wrist_cm: z.number().min(10).max(25).describe('Wrist circumference, centimetres') }, '/api/calc/body-frame');

tool('protein', 'Daily protein (range)',
  'Daily protein in g/day as bands: RDA minimum, active adults, deficit/muscle preservation, and per kg of lean mass when body-fat % is given.' + NOTE,
  { weight_kg: weight, body_fat_pct: bf.optional() }, '/api/calc/protein');

const flag = (what) => z.boolean().optional().describe(`Adds a fixed drinking-water bump for ${what}`);
tool('water', 'Daily water intake (range)',
  'Daily water need in ml and litres as a range across five authorities (IOM, WHO, EFSA, FNB, sports medicine), with optional lifestyle add-ons.' + NOTE,
  {
    sex, weight_kg: weight,
    activity: z.enum(['sedentary', 'light', 'active', 'moderate', 'very', 'extra', 'extreme']).describe('Activity level'),
    calorie_norm_kcal: z.number().min(800).max(6000).optional().describe('Daily calories, sharpens the FNB source'),
    coffee: flag('coffee'), alcohol: flag('alcohol'), protein_diet: flag('a high-protein diet'), workouts: flag('workouts'),
    hot_climate: flag('a hot climate'), pregnancy: flag('pregnancy'), breastfeeding: flag('breastfeeding'), illness: flag('illness'),
  }, '/api/calc/water');

tool('creatine', 'Creatine dose (range)',
  'Creatine monohydrate dose from body weight: maintenance range (g/day) and the optional loading route, from the ISSN position stand. Not a prescription.',
  { weight_kg: weight }, '/api/calc/creatine');

tool('one_rep_max', 'One-rep max (range)',
  'Estimated one-rep max as a range across Epley, Brzycki, Lombardi and Lander, the median, and a percent-of-1RM training table. Less precise above ~12 reps (flagged).',
  { weight_lifted_kg: z.number().min(1).max(1000).describe('Weight lifted, kilograms'), reps: z.number().int().min(1).max(36).describe('Repetitions completed') },
  '/api/calc/one-rep-max');

tool('vo2max', 'VO2max estimate (range)',
  'VO2max (ml/kg/min) as a range across the field methods you give data for: Uth heart-rate ratio, Cooper 12-minute run, Rockport 1-mile walk. Typically ±10–15% of a lab value.' + NOTE,
  {
    hr_rest_bpm: z.number().min(30).max(120).optional().describe('Resting heart rate (Uth; needs hr_max_bpm, or age + sex)'),
    hr_max_bpm: z.number().min(120).max(230).optional().describe('Measured max heart rate (Uth)'),
    cooper_m: z.number().min(600).max(5000).optional().describe('Metres covered in a 12-minute run (Cooper)'),
    walk_min: z.number().min(5).max(60).optional().describe('Minutes to walk 1 mile (Rockport; also needs finish_hr_bpm, weight_kg, age, sex)'),
    finish_hr_bpm: z.number().min(50).max(230).optional().describe('Heart rate at the end of the walk (Rockport)'),
    weight_kg: weight.optional(), age: age.optional(), sex: sex.optional(),
  }, '/api/calc/vo2max');

tool('running_pace', 'Running pace, time, distance',
  'Running pace solver: give any two of distance, time and pace to get the third plus speed. Optionally predicts a race time at another distance as a range (Riegel 1.06–1.08).',
  {
    distance_km: z.number().min(0.1).max(1000).optional().describe('Distance, km'),
    time_min: z.number().min(0.5).max(6000).optional().describe('Time in decimal minutes, e.g. 25.5'),
    pace_min_per_km: z.number().min(1).max(60).optional().describe('Pace in decimal minutes per km, e.g. 5.5'),
    target_distance_km: z.number().min(0.1).max(1000).optional().describe('Predict a race time at this distance'),
  }, '/api/calc/running-pace');

server.registerTool('get_formula', {
  title: 'Look up a formula in the WIMSTA registry',
  annotations: { title: 'Look up a formula in the WIMSTA registry', ...RO },
  description: 'Get one formula from the open WIMSTA formula registry (CC BY 4.0): equation, original study citation, population it was validated on, known limitations. Call list_formulas first to find ids.',
  inputSchema: { id: z.string().min(1).describe('Formula id, e.g. "cun-bae", "tanaka", "harris-benedict-1984"') },
}, async ({ id }) => asResult(await call('/api/formulas', { id })));

server.registerTool('list_formulas', {
  title: 'List formulas in the WIMSTA registry',
  annotations: { title: 'List formulas in the WIMSTA registry', ...RO },
  description: 'List the formulas in the open WIMSTA formula registry (CC BY 4.0), optionally filtered by category. Without a category returns the index of ids and categories.',
  inputSchema: { category: z.string().optional().describe('Category to filter by, one of body-fat, body-fat-ranges, bmi, waist-to-height, max-heart-rate, bmr; omit for the full index') },
}, async ({ category }) => asResult(await call('/api/formulas', { category })));

await server.connect(new StdioServerTransport());
