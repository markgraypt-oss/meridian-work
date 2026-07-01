import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type Fix = {
  issueType: string;
  title: string;
  description: string;
  contributors: string[];
  setupFactors: string[];
  positionChanges: string[];
  movementOptions: string[];
  orderIndex: number;
};

const fixes: Fix[] = [
  // ---------------- LOWER BACK ----------------
  {
    issueType: "lower_back",
    title: "Lower Back Ache From Prolonged Sitting",
    description:
      "A dull, building ache across the lower back that gets worse the longer you sit and eases when you stand and move. Long static sitting loads the discs and lets the supporting muscles fatigue. Sitting in one position with the hip flexors held short lets the glutes switch off, so the lower back takes the strain. It is the single most common desk complaint.",
    contributors: [
      "Hours in one fixed sitting position with no change.",
      "A slumped posture that rounds the lower back.",
      "No lower back support, so the spine loses its natural curve.",
      "Glutes switched off from sitting, leaving the back to do their work.",
      "A seat too low or too deep to sit tall in.",
    ],
    setupFactors: [
      "Use lumbar support, a cushion or rolled towel in the small of your back.",
      "Set the seat so your hips sit level with or just above your knees.",
      "Sit fully back so the backrest supports your spine.",
      "Keep the screen at eye level so you are not curling forward.",
      "Set a reminder to stand and move every thirty to forty-five minutes.",
    ],
    positionChanges: [
      "Sit tall with ribs stacked over hips, the natural curve supported.",
      "Switch to standing for blocks to unload the discs.",
      "Change position regularly rather than holding one for hours.",
    ],
    movementOptions: [
      "Stand, walk for a couple of minutes, and gently extend your lower back to release the pressure that builds from sitting.",
      "Seated or standing pelvic tilts to mobilise the lower back.",
      "Glute bridges to wake up the muscles that support the spine.",
      "A short walk every hour.",
      "Note: pain that travels down the leg or comes with numbness is worth getting checked.",
    ],
    orderIndex: 0,
  },
  {
    issueType: "lower_back",
    title: "Tight Lower Back And Anterior Pelvic Tilt",
    description:
      "The pelvis tips forward and the lower back arches more than it should, leaving a tight, pinched feeling across the low back that worsens through the day. It comes from the classic sitting pattern of short, tight hip flexors and weak glutes and core. Tight hip flexors pull the pelvis down while the glutes, hamstrings and core are too weak to counteract that forward pull, which increases the curve of the lower back.",
    contributors: [
      "Long sitting that shortens and tightens the hip flexors.",
      "Weak glutes and abdominals that cannot hold the pelvis level.",
      "A slumped or over-arched posture held for hours.",
      "Little movement to reset the pelvis through the day.",
      "Standing all day in the same arched position too.",
    ],
    setupFactors: [
      "Use lumbar support to hold a neutral spine rather than an arch.",
      "Set the seat so hips sit slightly above the knees to ease the hip flexors.",
      "Sit fully back and tall, not perched forward into the arch.",
      "Alternate sitting and standing to change the pelvis position.",
      "Use a reminder to reset your posture regularly.",
    ],
    positionChanges: [
      "Tuck the tailbone slightly to bring the pelvis to neutral.",
      "Engage the glutes gently when you stand to level the pelvis.",
      "Change position often so the hip flexors are not held short for hours.",
    ],
    movementOptions: [
      "Half-kneeling hip flexor stretch to release the tight muscles pulling the pelvis forward.",
      "Glute bridges and posterior pelvic tilts to strengthen the muscles that level the pelvis.",
      "Standing hip flexor stretch at the desk.",
      "Core work such as gentle planks to support the spine.",
      "Regular movement breaks, since the tilt builds with sustained sitting.",
    ],
    orderIndex: 1,
  },
  {
    issueType: "lower_back",
    title: "Sciatica-Type Pain Down The Leg",
    description:
      "Pain, and sometimes tingling or numbness, that travels from the lower back or buttock down the back of the leg. Prolonged sitting can compress or irritate the nerve root or the path the sciatic nerve takes. Excessive lumbar arching can compress the discs and nerves, which can show up as pain radiating down the leg. It often flares with sitting and eases with movement.",
    contributors: [
      "Long sitting that loads the lower back and compresses the nerve.",
      "A slumped position that increases disc pressure.",
      "Tight hips and an arched lower back narrowing the nerve's space.",
      "Sitting on a wallet or hard edge pressing into the buttock.",
      "Long unbroken stretches with no movement.",
    ],
    setupFactors: [
      "Use lumbar support and sit fully back to keep the spine neutral.",
      "Raise the seat so hips sit slightly above knees to reduce nerve tension.",
      "Remove anything from your back pocket before sitting.",
      "Use a cushioned seat rather than a hard surface.",
      "Set a timer to break up sitting regularly.",
    ],
    positionChanges: [
      "Sit tall and neutral, avoiding both slump and over-arch.",
      "Stand and walk the moment symptoms start to build.",
      "Change position often to keep pressure off the nerve.",
    ],
    movementOptions: [
      "A two-minute walk every thirty minutes, which unloads the nerve root and breaks the pressure cycle better than standing still.",
      "Gentle backward bends and pelvic tilts.",
      "Piriformis and hamstring stretches.",
      "Glute bridges to support the lower back.",
      "Important: leg pain with numbness, weakness, or any bladder or bowel changes needs prompt medical attention.",
    ],
    orderIndex: 2,
  },
  // ---------------- ELBOW ----------------
  {
    issueType: "elbow",
    title: "Golfer's Elbow (Inner Elbow)",
    description:
      "Pain on the inner bump of the elbow, sometimes running down towards the wrist, that flares with gripping and wrist bending. It is the inner-elbow cousin of tennis elbow. Inner elbow pain from wrist flexion or strong gripping points to golfer's elbow, felt on the inside bump and sometimes radiating down the forearm, triggered by typing or mousing with bent wrists.",
    contributors: [
      "Typing or mousing with the wrists bent and gripping firmly.",
      "Forceful or heavy keyboard use over long stretches.",
      "A tight, clenched grip on the mouse all day.",
      "Forearms twisted out of a neutral position.",
      "Long sessions with no breaks to recover.",
    ],
    setupFactors: [
      "Keep the keyboard low so wrists stay flat, not bent up or down.",
      "Bring the mouse close and keep elbows near your sides at about ninety degrees.",
      "Support your forearms rather than letting them hover.",
      "Use a light grip and lighter key presses.",
      "Consider a split keyboard to keep the wrists neutral.",
    ],
    positionChanges: [
      "Keep the wrist in line with the forearm, not flexed.",
      "Alternate tasks so the tendon is not loaded continuously.",
      "Vary sitting and standing to change the arm position.",
    ],
    movementOptions: [
      "Take a thirty to sixty second microbreak every twenty to thirty minutes to shake out the hands.",
      "Gentle wrist flexor stretch: arm straight, palm up, ease the wrist back.",
      "Stretch the fingers open every half hour to counter constant curling.",
      "Ice the inner elbow after a heavy session.",
      "Note: pain that lingers beyond a few weeks or wakes you at night is worth a clinician's assessment.",
    ],
    orderIndex: 1,
  },
  {
    issueType: "elbow",
    title: "Cubital Tunnel (Numb Little Finger)",
    description:
      "Numbness or tingling in the ring and little fingers, often with an ache at the inner elbow, from irritation of the ulnar nerve. Holding the elbow bent for long periods, or leaning it on a hard surface, narrows the tunnel the nerve passes through. Long bouts with bent elbows, like holding a phone to your ear or leaning on hard desk edges, narrow the cubital tunnel and irritate the nerve.",
    contributors: [
      "Long stretches with the elbows held tightly bent.",
      "Leaning the elbows on hard desk edges or chair arms.",
      "Cradling a phone against your ear for calls.",
      "Sleeping with the elbows fully bent (it carries over to the day).",
      "Repetitive bent-elbow positions with no breaks.",
    ],
    setupFactors: [
      "Keep elbows at a more open angle, not fully bent, while working.",
      "Pad or avoid hard desk edges and chair arms that press the inner elbow.",
      "Use a headset for calls instead of holding the phone.",
      "Set the desk so your forearms rest supported and level.",
      "Use armrests that support the forearm, not the point of the elbow.",
    ],
    positionChanges: [
      "Straighten the elbows out regularly through the day.",
      "Avoid resting your weight on your elbows.",
      "Change arm position often rather than holding one bend.",
    ],
    movementOptions: [
      "Gently straighten and bend the elbow to keep the nerve gliding.",
      "Take regular breaks to drop the arms straight by your sides.",
      "Shake out the hands and arms every half hour.",
      "Note: a short-term elbow pad or brace can help, but it is not a permanent fix.",
      "Important: persistent numbness, a weakening grip, or wasting of the hand muscles needs a clinician's assessment.",
    ],
    orderIndex: 2,
  },
  // ---------------- WRIST ----------------
  {
    issueType: "wrist",
    title: "Carpal Tunnel Syndrome",
    description:
      "Numbness, tingling or pain in the thumb, index and middle fingers, often worse at night or first thing, from pressure on the median nerve where it passes through the wrist. Constant wrist flexing on a flat keyboard can cause swelling that squeezes the nerve, leading to the tell-tale tingling and numbness in the fingers.",
    contributors: [
      "Typing for long stretches with the wrists bent up or down.",
      "Resting the wrists on the desk edge while typing.",
      "A flat keyboard forcing the wrists into extension.",
      "Repetitive motion with no recovery time.",
      "A tight grip and forceful key presses.",
    ],
    setupFactors: [
      "Set the desk so forearms are parallel to the floor and wrists stay neutral.",
      "Keep the keyboard low and flat so wrists are not bent up.",
      "Rest the heel of the palm, not the wrist, on any wrist rest.",
      "Consider a split or curved keyboard to ease the wrist angle.",
      "Bring the mouse close so you are not reaching and twisting.",
    ],
    positionChanges: [
      "Keep wrists straight and in line with the forearms.",
      "Avoid resting the wrists on hard edges while working.",
      "Change task and hand position regularly.",
    ],
    movementOptions: [
      "Stand, stretch, and shake out your hands and wrists every thirty to forty-five minutes.",
      "Gentle wrist circles and tendon glides through the day.",
      "Open and stretch the fingers to counter constant gripping.",
      "Take regular breaks to rest the wrists.",
      "Important: night-time numbness, a weakening grip, or constant tingling needs a clinician's assessment.",
    ],
    orderIndex: 0,
  },
  {
    issueType: "wrist",
    title: "Mouse Wrist (Wrist Tendonitis)",
    description:
      "An ache, stiffness or soreness across the wrist or back of the hand that builds through the day from repetitive mouse and keyboard use. Typing or mousing with bent wrists or a tight grip strains the forearm and hand muscles, which can inflame the tendons and cause overuse strain.",
    contributors: [
      "Repetitive clicking and typing with the wrist bent.",
      "A tight grip on the mouse all day.",
      "Resting the wrist on a hard edge while mousing.",
      "A mouse placed far away, forcing reach and twist.",
      "Long static positions with no breaks.",
    ],
    setupFactors: [
      "Keep the wrist neutral and floating, with the forearm supported on the desk or armrest.",
      "Bring the mouse close and level with the keyboard.",
      "Use a light grip and higher pointer speed to cut effort.",
      "Consider a vertical or ergonomic mouse for a more natural hand position.",
      "Avoid a mouse-specific wrist rest, which can push the wrist into extension.",
    ],
    positionChanges: [
      "Keep the wrist in line with the forearm, not cocked up.",
      "Alternate hands or tasks where you can.",
      "Vary sitting and standing to change the arm position.",
    ],
    movementOptions: [
      "Take a short microbreak every twenty to thirty minutes to shake out the hands.",
      "Gentle wrist flexion and extension stretches, holding twenty to thirty seconds.",
      "Tendon glides through the fingers and wrist.",
      "Switch to keyboard shortcuts to cut mouse load.",
      "Note: pain that persists beyond a couple of weeks is worth getting assessed.",
    ],
    orderIndex: 1,
  },
  {
    issueType: "wrist",
    title: "De Quervain's (Thumb-Side Wrist Pain)",
    description:
      "Pain on the thumb side of the wrist that flares when you grip, pinch or twist, from irritation of the tendons running to the thumb. Repetitive thumb movements and gripping, common with constant mouse and phone use, irritate these tendons. It can make lifting a mug or turning a key sharply painful.",
    contributors: [
      "Repetitive thumb movements, clicking and scrolling.",
      "Gripping and pinching the mouse all day.",
      "Heavy phone and thumb-typing use.",
      "A mouse that loads the thumb for cursor control.",
      "Twisting the wrist repeatedly with no recovery.",
    ],
    setupFactors: [
      "Keep the wrist neutral with the forearm supported.",
      "Use a mouse that does not rely on thumb buttons or gripping.",
      "Bring the mouse close to avoid reaching and twisting.",
      "Alternate pointing devices to spread the load off the thumb.",
      "Cut down thumb-heavy phone use through the workday.",
    ],
    positionChanges: [
      "Keep the thumb relaxed rather than gripping or pinching.",
      "Avoid repeated wrist twisting where you can.",
      "Change task and hand position regularly.",
    ],
    movementOptions: [
      "Take regular microbreaks to rest the thumb and wrist.",
      "Gentle thumb and wrist stretches within a pain-free range.",
      "Shake out the hands every half hour.",
      "Switch devices or tasks to reduce repetitive thumb load.",
      "Important: thumb-side wrist pain that lingers or worsens is worth a clinician's assessment.",
    ],
    orderIndex: 2,
  },
  // ---------------- HIP ----------------
  {
    issueType: "hip",
    title: "Tight Hip Flexors From Sitting",
    description:
      "A tight, pinched or aching feeling at the front of the hip, often worse when you stand up after sitting. Sitting holds the hip flexors in a shortened position for hours, and over time they tighten and stiffen. Sitting for extended periods keeps the hip flexors short, leading to adaptive shortening and chronic tightness that pulls on the pelvis and lower back.",
    contributors: [
      "Long hours sitting with the hips bent.",
      "Few breaks to stand and lengthen the hips.",
      "Weak glutes and core, so the hip flexors overwork.",
      "A slumped seated posture.",
      "Carrying the tightness into standing as an arched lower back.",
    ],
    setupFactors: [
      "Set the seat so hips sit level with or slightly above the knees.",
      "Sit fully back and tall rather than slumped.",
      "Alternate sitting and standing to change the hip angle.",
      "Use a perch or stool for some of the day to open the hips.",
      "Set a reminder to stand every thirty to forty-five minutes.",
    ],
    positionChanges: [
      "Stand tall and let the hips fully open when you get up.",
      "Switch to standing for blocks to lengthen the hip flexors.",
      "Change position regularly so the hips are not held short for hours.",
    ],
    movementOptions: [
      "Standing or half-kneeling hip flexor stretch, gently, several times a day.",
      "Glute bridges to wake up the muscles that balance the hips.",
      "Stand up and take a short walk every hour.",
      "Gentle hip circles and leg swings to keep the joint moving.",
      "Keep the stretch gentle, a mild pull rather than anything forced.",
    ],
    orderIndex: 0,
  },
  {
    issueType: "hip",
    title: "Deep Glute Ache (Piriformis)",
    description:
      "A deep ache or pressure in the buttock, sometimes with discomfort spreading down the leg, that builds with long sitting. The piriformis, a deep muscle in the buttock, tightens or spasms and can press on the nearby sciatic nerve. Prolonged sitting, especially on a hard surface, plus weak glutes and tight hip flexors, leaves this muscle overworked and irritated.",
    contributors: [
      "Long periods sitting, especially on a hard surface.",
      "Weak glutes that leave the piriformis overworking.",
      "Tight hip flexors adding strain to the deep hip muscles.",
      "Sitting on a wallet or hard edge pressing into the buttock.",
      "Little movement to release the muscle through the day.",
    ],
    setupFactors: [
      "Use a cushioned seat rather than a hard surface.",
      "Remove anything from your back pocket before sitting.",
      "Set the seat so the pelvis sits level and supported.",
      "Alternate sitting and standing to take pressure off the buttock.",
      "Set a reminder to get up regularly.",
    ],
    positionChanges: [
      "Sit evenly on both sit bones, not leaning onto one side.",
      "Stand and move before the ache settles in.",
      "Change position often to keep pressure off the muscle.",
    ],
    movementOptions: [
      "Piriformis stretch: lying down or seated, cross one ankle over the opposite knee and ease the knee towards your chest.",
      "Glute bridges to strengthen the muscles that support the deep hip.",
      "Stand and walk regularly to release the muscle.",
      "Gentle figure-four stretch within a comfortable range.",
      "Important: buttock or leg pain with numbness, tingling or weakness needs a clinician's assessment.",
    ],
    orderIndex: 1,
  },
  {
    issueType: "hip",
    title: "Stiff Hips And Reduced Mobility",
    description:
      "A general stiffness in the hips after sitting, where the joint feels tight and slow to move when you first stand. It comes from holding the hips in one position for hours rather than from any single injury. Hip stiffness after sitting is usually a reflection of the hips and legs being in the same posture for an extended period, with the glutes, core and hip extensors weakening over time.",
    contributors: [
      "Hours with the hips held in one bent position.",
      "Weak glutes, core and hip extensors from prolonged sitting.",
      "Few full-range hip movements across the day.",
      "A low or deep seat that keeps the hips compressed.",
      "Little variation in how you sit.",
    ],
    setupFactors: [
      "Set the seat so hips sit level with or just above the knees.",
      "Sit with feet, pelvis and spine aligned and supported.",
      "Alternate sitting and standing to move the hips through the day.",
      "Use a perch or stool for some of the day for a more open hip angle.",
      "Set a reminder to get up and move regularly.",
    ],
    positionChanges: [
      "Stand tall and let the hips open fully when you rise.",
      "Switch positions often so the hips are not fixed for hours.",
      "Use standing blocks to keep the hips mobile.",
    ],
    movementOptions: [
      "Gentle walking and stretching to warm up the joints, which eases stiffness well.",
      "Hip circles and leg swings to move the joint through its range.",
      "Seated hip stretches at the desk, rocking the pelvis gently.",
      "Sit-to-stand from the chair to train the movement that stiffens.",
      "A short walk every hour to keep the hips moving.",
    ],
    orderIndex: 2,
  },
];

async function run() {
  console.log("Starting aches & fixes seed...\n");
  const existing = await pool.query("SELECT title FROM workday_aches_fixes");
  const existingTitles = existing.rows.map((r: any) => r.title);
  let inserted = 0;
  let skipped = 0;
  for (const f of fixes) {
    if (existingTitles.includes(f.title)) {
      console.log("SKIP: " + f.title);
      skipped++;
      continue;
    }
    await pool.query(
      `INSERT INTO workday_aches_fixes (issue_type,title,description,contributors,setup_factors,position_changes,movement_options,order_index,is_active,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
      [
        f.issueType,
        f.title,
        f.description,
        f.contributors,
        f.setupFactors,
        f.positionChanges,
        f.movementOptions,
        f.orderIndex,
        true,
      ]
    );
    console.log("INSERTED: " + f.issueType + " | " + f.title);
    inserted++;
  }
  console.log("\nDone. " + inserted + " inserted, " + skipped + " skipped.");
  await pool.end();
}
run().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
