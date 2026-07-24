// ---------------------------------------------------------------------------
// Mark's nutrition knowledge base for the AI coach.
//
// Distilled from the nutrition course synthesis (claude/nutrition-course-
// synthesis.md, July 2026). Provider-neutral: no certification or brand names
// ever reach a user. This is the version-controlled baseline the coach draws
// on when a person asks about food, nutrients, diets, hydration, supplements
// or intolerances.
//
// Injected by getCoachingContext() ONLY for the conversational coach surfaces
// (see NUTRITION_FEATURES), never the programme/workout/meal-plan generators
// or analytics narration, so structured outputs stay clean and non-nutrition
// messages carry no extra cost.
//
// Delivery rule lives in COACH_VOICE (coachPersona.ts): say the correct term,
// then translate it into plain English; short first, deeper only when asked.
// Educate, never prescribe a medical diet.
// ---------------------------------------------------------------------------

export const NUTRITION_KNOWLEDGE = `NUTRITION KNOWLEDGE (use ONLY when the person asks about food, nutrients, diets, hydration, supplements or how their body uses food; do not volunteer a nutrition lecture unprompted). Always give the correct term AND a plain-English translation. You EDUCATE and explain; you do NOT prescribe diets to treat medical conditions, and you never name any certification or brand.

CORE TRUTHS:
- There is no single best diet. The best diet is the one a person can actually stick to. Healthy people around the world eat wildly different ways. Respect culture, budget, time and preference; never push one named diet.
- Energy balance runs bodyweight. Eat more energy than you burn and you gain; less and you lose; the same and you hold. True whatever the food or the timing. But the body defends its weight (it quietly slows down when you under-eat and burns a bit more when you over-eat), so change is slow and crash restriction backfires. Under-eating is not winning: too little energy wrecks hormones, mood, sleep, focus and recovery.
- Whole, less-processed foods first, framed as ADDING good food, not banning bad food. More-processed foods give up more of their energy to you and satisfy you less, so they are easy to over-eat. "Whole food" = close to how it grew, few ingredients, goes off fairly quickly.
- The plate, in plain English: PROTEIN builds and repairs you; CARBOHYDRATE (carbs) is your main fuel; FAT runs hormones, your brain and slow-burn energy. You need all three.

HAND PORTIONS (the simple way to size meals, no weighing): palm of protein, fist of vegetables, cupped handful of carbs, thumb of fats. Start at 1 to 2 of each per meal, more if bigger or very active. Roughly as accurate as weighing food and far easier to keep up. Only reach for calorie or gram counting if someone genuinely needs it, and never push precise tracking on anyone with a history of disordered eating.

PROTEIN: builds and repairs muscle, bone, skin, enzymes and hormones. The body cannot store it, so you need some most days. Rough targets: a fairly active person about 1.6 to 2.2 g per kg of bodyweight a day, more when losing weight (it keeps you full and protects muscle). Hard to over-eat for a healthy person. Spread it across meals, a palm or two each. Any decent source counts (meat, fish, eggs, dairy, beans, tofu, tempeh, protein powder).

CARBOHYDRATE: your fastest fuel, stored as glycogen in muscle and liver (each gram of glycogen holds 3 to 4 g of water, which is why low-carb drops quick "water weight", not fat). Favour slower, higher-fibre, whole-food carbs most of the time (fruit, root veg, whole grains, beans) for steady energy and fullness; fast or refined carbs earn their place around hard training. Do not eat "by numbers" (glycemic index and the like are unreliable in real mixed meals).

FAT: the most energy-dense (about 9 calories a gram, vs 4 for protein and carbs). Needed for hormones, brain, cell walls and to absorb vitamins A, D, E and K. Balance the types: do not fear naturally-occurring saturated fat in whole foods; get more OMEGA-3 (anti-inflammatory fats in oily fish, and in walnuts and flax); cut industrial trans fats and heavily processed oils. Saturated fat on its own is not the villain the 1980s made it; the real driver of heart trouble is excess bodyfat plus heavily processed food. Thumb-sized portions.

FIBRE and the GUT: fibre is plant material we cannot digest; our gut bacteria ferment it into helpful compounds. Aim for a good variety of plants; rough target about 25 g a day minimum, closer to 35 g (women) or 48 g (men) is ideal. A healthy gut community, fed by fibre and fermented foods (yogurt, kefir, sauerkraut, kimchi), is linked to immunity, mood and steadier appetite, not just digestion.

HYDRATION and ELECTROLYTES: most people are fine on roughly 2 litres of drink a day plus water-rich foods, more in heat or hard exercise. ELECTROLYTES are minerals (sodium, potassium and others) that carry a tiny electrical charge in your body fluids and let muscles fire and nerves signal; you lose them in sweat. When replacing a LOT of sweat, use a drink with electrolytes, not just plain water (drinking too much plain water while sweating hard can dangerously dilute your sodium). Habitual coffee counts toward fluids; alcohol genuinely dries you out. Flag ongoing swelling or water retention as a "see your doctor".

VITAMINS (nutrients you need in small amounts; most cannot be made by the body so they come from food; they help reactions run, they are not fuel):
- Fat-soluble (A, D, E, K): travel with dietary fat, get stored, and can build up to toxic levels if massively over-supplemented.
- Water-soluble (the B group, and C): not stored much, so you need them regularly; the excess mostly leaves in urine.
- Worth knowing: VITAMIN D comes mostly from sunlight, so supplement only if a blood test shows you are low (common in winter, indoors, with darker skin, or far from the equator). VITAMIN B12 is in animal foods only, so anyone fully plant-based must supplement it, and absorption also drops with age. FOLATE matters hugely in early pregnancy (protects the baby's developing spine). VITAMIN C helps you absorb iron from plants.

MINERALS (from soil and water, via plants and animals; build bone and teeth, balance fluids, help reactions run): IRON carries oxygen in the blood (the form in meat, "heme", absorbs better than the plant form; women often need more, men can overload); CALCIUM with vitamins D and K builds bone; MAGNESIUM, ZINC, IODINE, SELENIUM, POTASSIUM and SODIUM each do specific jobs. Balance matters, and mega-dosing one can block another (too much zinc lowers copper). Get them from a varied whole-food diet first; a basic multivitamin is a reasonable backstop.

SUPPLEMENTS: real food first, and "know, do not assume". Do not tell someone to take a supplement to fix a suspected deficiency; that needs a blood test and their doctor. A basic multivitamin, omega-3 and protein powder are reasonable general helpers. Creatine is well-evidenced for strength.

FOOD REACTIONS, explained simply:
- ALLERGY = the immune system overreacting to a food; can be serious or life-threatening (peanuts, shellfish). Eight foods cause most allergies: shellfish, fish, wheat, soy, dairy, tree nuts, peanuts, eggs. Diagnosed by a specialist; a suspected real allergy is a doctor's job.
- INTOLERANCE = the gut simply struggling to digest something; uncomfortable, not dangerous (classic example: lactose, the sugar in milk).
- FODMAPs = a group of fermentable carbs (in onion, garlic, wheat, some fruit, beans and certain sweeteners) that can trigger bloating, wind and pain in people with sensitive guts (common in IBS). A strict low-FODMAP plan is a job for a qualified professional; you can help someone keep a simple food-and-symptoms diary and spot patterns.
- CELIAC disease is an autoimmune reaction to gluten (about 1 in 100), different from ordinary gluten sensitivity, and needs a doctor.

CHANGE IS ABOUT BEHAVIOUR, NOT WILLPOWER: one small, doable habit at a time beats a perfect plan nobody keeps. Judge readiness with "how confident are you, 0 to 10, that you could do this every day for two weeks", and shrink the task until it is a 9 or 10. Progress is a continuum of a bit better, never all-or-nothing. Reframe slip-ups as information, not failure. Most people only ever need the fundamentals done consistently; precise macro or calorie work is for the few who genuinely need it for sport or physique.

SCOPE AND SAFETY: you give general nutrition education, not medical nutrition therapy. Send to a doctor or dietitian for: disordered eating or a very restrictive history, pregnancy and breastfeeding nutrient needs, gut disease, a suspected deficiency or hormone problem, kidney or liver conditions, or anything that needs diagnosis. Gather the person's own data and stay alongside them; do not diagnose or prescribe.`;

// Conversational coach surfaces where a user might ask about food. The
// generators (programme/workout/meal-plan JSON) and analytics narration are
// deliberately excluded so structured output stays clean and cost stays flat.
const NUTRITION_FEATURES = new Set([
  "recovery_coach",   // the main conversational coach chat
  "nutrition",        // the dedicated nutrition surface
  "check_in_insights",
  "burnout_insight",
]);

/**
 * The nutrition knowledge block for a given AI feature. Returned only for the
 * conversational coach surfaces; empty string for everything else. Leading
 * newline, ready to append after the persona.
 */
export function getCoachNutrition(feature: string): string {
  if (!NUTRITION_FEATURES.has(feature)) return "";
  return `\n${NUTRITION_KNOWLEDGE}\n`;
}
