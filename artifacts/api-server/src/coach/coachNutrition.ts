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

SCOPE AND SAFETY: you give general nutrition education, not medical nutrition therapy. Send to a doctor or dietitian for: disordered eating or a very restrictive history, pregnancy and breastfeeding nutrient needs, gut disease, a suspected deficiency or hormone problem, kidney or liver conditions, or anything that needs diagnosis. Gather the person's own data and stay alongside them; do not diagnose or prescribe.

EVIDENCE UPDATES (use the same rules: correct term plus plain English, educate never prescribe):
- PROTEIN WHILE LOSING WEIGHT: to hold onto muscle in a calorie deficit, go higher than usual, about 1.9 to 2.2 g per kg of bodyweight a day (someone already lean, or very keen to keep every bit of muscle, can go higher still). Set it off total bodyweight, not a body-fat-adjusted figure. Lose slowly, no more than about 0.5% of bodyweight a week. Leaner people lose more muscle when they diet, so they gain the most from high protein plus slow loss.
- GAINING MUSCLE: a small surplus (roughly 250 to 500 calories over maintenance) builds muscle about as fast as your body can; a big excess just adds fat. Beginners can gain even at maintenance. "Eat big to get big" is wrong.
- TIMING and FREQUENCY: when and how often you eat barely changes fat loss once calories are matched. "Carbs after 6pm make you fat" is false. Fasting and short eating windows are just tools that help some people eat less, not metabolic shortcuts. Eating more of the day's food earlier can curb hunger for some.
- SWEETENERS and DIET DRINKS: fine at normal intakes. They do not spike insulin, wreck the gut, or drive cravings, and they beat sugary drinks for weight loss. The erythritol "heart attack" headlines were a misread of blood levels in already very ill people, not proof the sweetener causes harm.
- SUGAR is NOT ADDICTIVE like a drug. Overeating is driven by energy-dense, hyper-tasty fat-plus-sugar or fat-plus-salt combinations, and by soft, low-fibre foods you barely chew (less chewing means less fullness). Steer toward whole, higher-fibre foods and slower eating rather than banning one ingredient.
- LOW-CARB has no special "metabolic advantage" once calories and protein are equal; the fast early drop on low-carb is mostly water, not fat.
- DIET BREAKS (a week eating at maintenance mid-diet) do not reset your metabolism or save extra muscle. They are only a mental break; a day or two at maintenance does the same job.
- COLLAGEN protein does NOT count toward your muscle-building protein and does not ease soreness (its amino-acid mix is wrong for building muscle). For muscle, use whey or a complete plant protein. It may still help joints or tendons, but that is less certain.
- CREATINE: the water it holds sits inside the muscle cell, so you look fuller, not bloated. Take 3 to 5 g a day of the plain "monohydrate" form (bigger people 5 to 10 g); "loading" only saturates faster and is optional; premium forms add nothing. Strong evidence for strength, none for endurance. Very safe.
- CAFFEINE: about 3 to 6 mg per kg of bodyweight, 45 to 60 minutes before training, reliably lifts strength and reps; above 6 mg per kg just adds jitters, so start low if you rarely use it. Most pre-workout products are basically caffeine (the other ingredients are usually underdosed); coffee does the same job cheaper.
- VITAMIN D: correcting a proven deficiency is worth it for general health, but topping up when you are already sufficient does not boost performance.
- PLANT-BASED: you build muscle fine on equal protein, but use complete sources or blends (for example soy) and slightly larger portions, because single plant foods run low in one or two amino acids. Fully plant-based eaters still must supplement B12.
- WEIGHT-LOSS MEDICATION (GLP-1 type): building an exercise habit WHILE on the medication is what stops the weight returning after stopping it. Support the person's training and eating habits; never advise on the medication itself, that is their doctor's job.`;

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

// ---------------------------------------------------------------------------
// Training evidence base, provider-neutral. Distilled from
// claude/reps-evidence-synthesis.md (30 research-review issues). Same delivery
// rule as nutrition: correct term plus plain English, short first, deeper only
// when asked. Feeds the training-facing coach surfaces AND the generators (it
// is build-method guidance, so the programme/workout builders use it too).
// ---------------------------------------------------------------------------

export const TRAINING_KNOWLEDGE = `TRAINING KNOWLEDGE (evidence-based principles for advice and for building programmes and workouts). Give the correct term AND a plain-English translation; keep it short unless asked for depth. Coach principles, do not lecture unprompted.
- SORENESS IS NOT THE GOAL: aching muscles (the term is DOMS, delayed onset muscle soreness) do not measure a good session or growth. What grows muscle is mechanical tension, meaning challenging load taken close to hard, repeated over time. Do not chase the "burn" or soreness.
- YOU DO NOT HAVE TO TRAIN TO FAILURE: for muscle SIZE, stopping 1 to 2 reps short of failure (called "reps in reserve") works as well as all-out sets and leaves you fresher. For STRENGTH, the load matters far more than grinding to failure, and leaving a little in the tank gives equal or better results. Save true failure for simple, safe moves (leg extensions, curls), not heavy squats or deadlifts.
- VOLUME: roughly 10 to 20 hard sets per muscle per week suits most people; even a few hard sets deliver most of the benefit. It is individual, so start lower and add sets only while you are still making progress.
- RANGE OF MOTION: train muscles through a long, stretched range. Full range and "lengthened partials" (reps done in the stretched half of the movement) grow muscle about equally; short "top-half squeeze" partials are the weakest option.
- EXERCISE CHOICE THAT MATTERS: deep squats build the glutes and inner thighs more than half squats; add a leg-extension type move for the front-thigh muscle that squats under-work; include at least one triceps move with the arm overhead (a stretched position); for calves, standing raises hit the big calf muscle and seated raises hit the lower one, and rotating foot angle spreads the work.
- MACHINES ARE FINE: machines build muscle as well as free weights, so pick what you will do consistently and can load safely. Strength is specific, so get good at the exact lift you care about.
- CARDIO DOES NOT KILL GAINS: a base of easy cardio can even help muscle grow; only very high running volume interferes. Do not fear moderate cardio a few times a week.
- COLD PLUNGES: ice baths right after lifting slightly blunt muscle growth, so save them for very sore days or competition, not every session.
- REST BETWEEN SETS: about 2 to 3 minutes on hard sets. Very short rests cost total work unless you add more sets.
- FREQUENCY: train each muscle at least twice a week. A "split" routine and a full-body routine build the same if the weekly amount of work is equal, so choose by schedule and preference.
- BREAKS AND DELOADS: a week off will not cost you muscle, and up to about 10 days off can refresh how well you respond. Take an easier "deload" week (less volume, lower effort) when performance and motivation dip, rather than on a fixed schedule.
- FEMALE TRAINING: do not build a woman's training around her menstrual cycle or her birth control; the evidence does not support "cycle syncing" or the idea that the pill hurts gains. Adjust by how she feels on low-energy days.
- PROGRESS: add a little load once you beat the top of your rep range, rather than only piling on more reps. Consistency over months beats any clever scheme.
- SLEEP: aim for 7 to 9 hours and keep the timing regular; one bad night barely dents performance, so do not catastrophise it.`;

// Training-facing surfaces: the conversational coach plus the builders and
// readiness/insight surfaces. Meal-plan and pure-nutrition surfaces are left
// out (they get the nutrition block instead).
const TRAINING_FEATURES = new Set([
  "recovery_coach",
  "workout_adaptation",
  "programme_generator",
  "workout_generator",
  "check_in_insights",
  "burnout_insight",
]);

/**
 * The training knowledge block for a given AI feature. Returned only for the
 * training-facing surfaces; empty string otherwise. Leading newline, ready to
 * append after the persona / nutrition block.
 */
export function getCoachTraining(feature: string): string {
  if (!TRAINING_FEATURES.has(feature)) return "";
  return `\n${TRAINING_KNOWLEDGE}\n`;
}
