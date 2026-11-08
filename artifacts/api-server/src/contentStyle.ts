import { pool } from "./db";

/**
 * House style for everything the app shows: no em dashes, British spelling.
 *
 * Mark found em dashes ("Core — Standing & Carry Circuit") and American
 * spellings all over the app. The app's own strings are fixed in the app;
 * this covers the words that live in the database: workout and programme
 * names and descriptions, exercise names, habit templates, learning content,
 * recipes, breathwork and desk-health text, and so on.
 *
 * Only content tables are touched (see CONTENT_TABLES): nothing a user wrote
 * about themselves, nothing in users, sessions or logs. Column names that are
 * clearly not prose (urls, ids, slugs, keys, types, statuses) are skipped,
 * since those are matched by code. JSON columns get the em dash fix only; a
 * spelling change inside JSON could rename a key the code relies on.
 */

export const CONTENT_TABLES = [
  "exercise_library", "programs", "program_weeks", "program_days", "programme_workouts",
  "programme_exercises", "programme_workout_blocks", "programme_block_exercises", "videos",
  "recipes", "workouts", "workout_blocks", "block_exercises", "body_map_areas",
  "body_map_guidance_rules", "body_map_questions", "body_map_answer_options",
  "body_map_movement_options", "body_map_recovery_templates", "body_map_outcomes",
  "habit_templates", "learn_topics", "learn_content_library", "learning_paths",
  "topic_content_items", "learning_path_content", "path_content_items", "audio_sessions",
  "daily_quotes", "breath_techniques", "meal_plans", "meal_plan_days", "meal_plan_meals",
  "workday_positions", "workday_micro_resets", "workday_aches_fixes", "workday_desk_tips",
  "workday_desk_references", "workday_desk_setups", "badges", "mindfulness_tools",
  "meditations", "recommendations", "exercise_swap_lines", "program_exercises",
  "exercise_substitution_mappings", "company_benefits",
];

const SKIP_COLUMN = /(url|_id$|^id$|slug|key|token|hash|email|path|type|status|code|color|colour|icon|category|level|unit|locale|provider|model|tag|sku|mux|playback)/i;

// American -> British. Lower-case forms; capitalised and upper-case forms are
// handled when applied. Each entry is a whole word.
export const SPELLING: [string, string][] = [
  ["program", "programme"], ["programs", "programmes"], ["programmed", "programmed"],
  ["color", "colour"], ["colors", "colours"], ["colored", "coloured"],
  ["favorite", "favourite"], ["favorites", "favourites"],
  ["center", "centre"], ["centers", "centres"], ["centered", "centred"],
  ["meter", "metre"], ["meters", "metres"], ["kilometer", "kilometre"], ["kilometers", "kilometres"],
  ["liter", "litre"], ["liters", "litres"], ["milliliter", "millilitre"], ["milliliters", "millilitres"],
  ["fiber", "fibre"], ["fibers", "fibres"],
  ["behavior", "behaviour"], ["behaviors", "behaviours"], ["behavioral", "behavioural"],
  ["flavor", "flavour"], ["flavors", "flavours"], ["flavorful", "flavourful"],
  ["honor", "honour"], ["humor", "humour"], ["vigor", "vigour"], ["savor", "savour"],
  ["labor", "labour"], ["endeavor", "endeavour"], ["neighbor", "neighbour"], ["neighbors", "neighbours"],
  ["odor", "odour"], ["armor", "armour"], ["rumor", "rumour"],
  ["gray", "grey"], ["mold", "mould"], ["plow", "plough"],
  ["defense", "defence"], ["offense", "offence"], ["license", "licence"],
  ["practicing", "practising"], ["practiced", "practised"],
  ["canceled", "cancelled"], ["canceling", "cancelling"],
  ["traveling", "travelling"], ["traveled", "travelled"], ["traveler", "traveller"],
  ["modeling", "modelling"], ["modeled", "modelled"], ["labeled", "labelled"], ["labeling", "labelling"],
  ["leveled", "levelled"], ["leveling", "levelling"], ["totaled", "totalled"], ["totaling", "totalling"],
  ["signaling", "signalling"], ["signaled", "signalled"], ["fueling", "fuelling"], ["fueled", "fuelled"],
  ["channeled", "channelled"], ["channeling", "channelling"], ["counselor", "counsellor"], ["counseling", "counselling"],
  ["enrollment", "enrolment"], ["enrollments", "enrolments"], ["enroll", "enrol"], ["enrolls", "enrols"],
  ["fulfill", "fulfil"], ["fulfills", "fulfils"], ["fulfillment", "fulfilment"], ["skillful", "skilful"],
  ["installment", "instalment"], ["installments", "instalments"],
  ["aging", "ageing"], ["math", "maths"], ["skeptical", "sceptical"], ["skeptic", "sceptic"],
  ["pajamas", "pyjamas"], ["mustache", "moustache"], ["jewelry", "jewellery"],
  ["pediatric", "paediatric"], ["orthopedic", "orthopaedic"], ["anesthesia", "anaesthesia"],
  ["anemia", "anaemia"], ["anemic", "anaemic"], ["edema", "oedema"], ["esophagus", "oesophagus"],
  ["estrogen", "oestrogen"], ["diarrhea", "diarrhoea"], ["hemoglobin", "haemoglobin"],
  ["catalog", "catalogue"], ["dialog", "dialogue"], ["analog", "analogue"],
  ["optimize", "optimise"], ["optimizes", "optimises"], ["optimized", "optimised"], ["optimizing", "optimising"], ["optimization", "optimisation"],
  ["organize", "organise"], ["organizes", "organises"], ["organized", "organised"], ["organizing", "organising"], ["organization", "organisation"],
  ["realize", "realise"], ["realizes", "realises"], ["realized", "realised"], ["realizing", "realising"],
  ["recognize", "recognise"], ["recognizes", "recognises"], ["recognized", "recognised"], ["recognizing", "recognising"],
  ["customize", "customise"], ["customizes", "customises"], ["customized", "customised"], ["customizing", "customising"], ["customization", "customisation"],
  ["personalize", "personalise"], ["personalizes", "personalises"], ["personalized", "personalised"], ["personalizing", "personalising"], ["personalization", "personalisation"],
  ["prioritize", "prioritise"], ["prioritizes", "prioritises"], ["prioritized", "prioritised"], ["prioritizing", "prioritising"], ["prioritization", "prioritisation"],
  ["minimize", "minimise"], ["minimizes", "minimises"], ["minimized", "minimised"], ["minimizing", "minimising"],
  ["maximize", "maximise"], ["maximizes", "maximises"], ["maximized", "maximised"], ["maximizing", "maximising"],
  ["emphasize", "emphasise"], ["emphasizes", "emphasises"], ["emphasized", "emphasised"], ["emphasizing", "emphasising"],
  ["utilize", "utilise"], ["utilizes", "utilises"], ["utilized", "utilised"], ["utilizing", "utilising"],
  ["energize", "energise"], ["energizes", "energises"], ["energized", "energised"], ["energizing", "energising"],
  ["visualize", "visualise"], ["visualizes", "visualises"], ["visualized", "visualised"], ["visualizing", "visualising"], ["visualization", "visualisation"],
  ["summarize", "summarise"], ["summarizes", "summarises"], ["summarized", "summarised"], ["summarizing", "summarising"],
  ["categorize", "categorise"], ["categorizes", "categorises"], ["categorized", "categorised"], ["categorizing", "categorising"],
  ["specialize", "specialise"], ["specializes", "specialises"], ["specialized", "specialised"], ["specializing", "specialising"],
  ["stabilize", "stabilise"], ["stabilizes", "stabilises"], ["stabilized", "stabilised"], ["stabilizing", "stabilising"], ["stabilization", "stabilisation"],
  ["mobilize", "mobilise"], ["mobilizes", "mobilises"], ["mobilized", "mobilised"], ["mobilizing", "mobilising"], ["mobilization", "mobilisation"],
  ["normalize", "normalise"], ["normalizes", "normalises"], ["normalized", "normalised"], ["normalizing", "normalising"],
  ["memorize", "memorise"], ["memorized", "memorised"], ["memorizing", "memorising"],
  ["apologize", "apologise"], ["apologized", "apologised"],
  ["analyze", "analyse"], ["analyzes", "analyses"], ["analyzed", "analysed"], ["analyzing", "analysing"],
  ["paralyze", "paralyse"], ["paralyzed", "paralysed"],
  ["synchronize", "synchronise"], ["synchronized", "synchronised"], ["synchronization", "synchronisation"],
  ["capitalize", "capitalise"], ["capitalized", "capitalised"], ["capitalizing", "capitalising"],
  ["harmonize", "harmonise"], ["harmonized", "harmonised"],
  ["revitalize", "revitalise"], ["revitalized", "revitalised"], ["revitalizing", "revitalising"],
  ["neutralize", "neutralise"], ["neutralized", "neutralised"], ["neutralizing", "neutralising"],
  ["equalize", "equalise"], ["equalized", "equalised"],
  ["criticize", "criticise"], ["criticized", "criticised"], ["criticizing", "criticising"],
  ["familiarize", "familiarise"], ["familiarized", "familiarised"], ["familiarizing", "familiarising"],
  ["internalize", "internalise"], ["internalized", "internalised"],
  ["socialize", "socialise"], ["socializing", "socialising"],
  ["sympathize", "sympathise"], ["empathize", "empathise"],
  ["theorize", "theorise"], ["improvize", "improvise"],
  ["metabolize", "metabolise"], ["metabolized", "metabolised"], ["metabolizing", "metabolising"],
  ["vaporize", "vaporise"], ["pulverize", "pulverise"],
].filter(([a, b]) => a !== b) as [string, string][];

const WORD_RE = new RegExp("\\b(" + SPELLING.map(([a]) => a).join("|") + ")\\b", "gi");
const UK = new Map(SPELLING);

function matchCase(src: string, out: string): string {
  if (src === src.toUpperCase() && src.length > 1) return out.toUpperCase();
  if (src[0] === src[0].toUpperCase()) return out[0].toUpperCase() + out.slice(1);
  return out;
}

/** Replace em and en dashes used as punctuation with a plain hyphen. */
export function fixDashes(text: string): string {
  return text
    .replace(/\s* - \s*/g, " - ")      // em dash, with or without spaces
    .replace(/(\S)\s+–\s+(\S)/g, "$1 - $2") // spaced en dash between words
    .replace(/(\d)–(\d)/g, "$1-$2")  // en dash in a number range
    .replace(/–/g, "-")              // any en dash left
    .replace(/ - - /g, " - ");
}

/** British spelling for the words in SPELLING, keeping capitalisation. */
export function fixSpelling(text: string): string {
  return text.replace(WORD_RE, (m) => {
    const uk = UK.get(m.toLowerCase());
    return uk ? matchCase(m, uk) : m;
  });
}

export function houseStyle(text: string, opts: { spelling?: boolean } = {}): string {
  let out = fixDashes(text);
  if (opts.spelling !== false) out = fixSpelling(out);
  return out;
}

export async function applyHouseStyleToContent(opts: { dryRun?: boolean; tables?: string[] } = {}): Promise<{
  tables: number; columns: number; rowsChanged: number; samples: any[]; errors: any[];
}> {
  const tables = opts.tables && opts.tables.length ? opts.tables.filter(t => CONTENT_TABLES.includes(t)) : CONTENT_TABLES;
  const cols = await pool.query(
    `SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ANY($1)
        AND data_type IN ('text', 'character varying', 'jsonb', 'json')
      ORDER BY table_name, column_name`, [tables]);
  let columns = 0, rowsChanged = 0;
  const samples: any[] = [];
  const errors: any[] = [];
  const seenTables = new Set<string>();
  for (const { table_name, column_name, data_type } of cols.rows) {
    if (SKIP_COLUMN.test(column_name)) continue;
    const isJson = data_type === "jsonb" || data_type === "json";
    columns++;
    seenTables.add(table_name);
    try {
      const sel = isJson
        ? `SELECT id, ${column_name}::text AS v FROM ${table_name} WHERE ${column_name}::text ~ '[—–]'`
        : `SELECT id, ${column_name} AS v FROM ${table_name} WHERE ${column_name} ~* '[—–]|\\m(${SPELLING.map(([a]) => a).join("|")})\\M'`;
      const rows = await pool.query(sel);
      for (const { id, v } of rows.rows) {
        if (typeof v !== "string") continue;
        // Single words are often values the code matches on ("center",
        // "program"); only prose (anything with a space) gets respelt.
        const prose = /\s/.test(v.trim());
        const next = isJson ? fixDashes(v) : houseStyle(v, { spelling: prose });
        if (next === v) continue;
        rowsChanged++;
        if (samples.length < 150) samples.push({ table: table_name, column: column_name, id, before: v.slice(0, 160), after: next.slice(0, 160) });
        if (opts.dryRun) continue;
        if (isJson) {
          await pool.query(`UPDATE ${table_name} SET ${column_name} = $1::${data_type} WHERE id = $2`, [next, id]);
        } else {
          await pool.query(`UPDATE ${table_name} SET ${column_name} = $1 WHERE id = $2`, [next, id]);
        }
      }
    } catch (err: any) {
      errors.push({ table: table_name, column: column_name, error: err?.message || String(err) });
    }
  }
  return { tables: seenTables.size, columns, rowsChanged, samples, errors };
}
