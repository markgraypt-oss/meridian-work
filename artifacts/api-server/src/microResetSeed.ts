// ---------------------------------------------------------------------------
// Bulk import: 48 Micro-Reset videos (Mux batch uploaded 22 Jul 2026).
//
// Source of truth for the July 2026 micro-reset drop. Each entry maps a Mux
// playback ID to the full micro-reset record (name, target area, description,
// steps, suggested timer). Idempotent: items whose muxPlaybackId already
// exists in workday_micro_resets are skipped, so re-running is always safe.
//
// Run on Replit after review:
//   npx tsx -e "import('./server/microResetSeed').then(m => m.runMicroResetImport()).then(r => { console.log(JSON.stringify(r, null, 2)); process.exit(0); })"
// or POST /api/admin/workday/micro-resets/bulk-import (requireAdmin).
//
// The import finishes by triggering the Mux caption backfill (paced,
// idempotent) so all 48 get auto-generated subtitles without a second step.
// ---------------------------------------------------------------------------

import { db } from "./db";
import { workdayMicroResets } from "@workspace/db";

type SeedItem = {
  muxPlaybackId: string;
  name: string;
  targetArea: "neck" | "upper_back" | "lower_back" | "hips" | "wrists" | "shoulder";
  duration: number; // suggested seconds for the in-app timer
  description: string;
  steps: string[];
};

export const MICRO_RESET_SEED: SeedItem[] = [
  {
    muxPlaybackId: "s83NQjMeO3HeXd022c7OY2FCE8pcvjHlHVsWSlhvGnDE",
    name: "Foam Roller T-Spine",
    targetArea: "upper_back",
    duration: 45,
    description: "Opens up a stiff mid-back after long stretches of sitting. A slow, controlled roll that restores extension through the thoracic spine.",
    steps: [
      "Sit on the floor with a foam roller behind you, across your mid-back.",
      "Support your head with your hands and lean back over the roller.",
      "Slowly roll between your shoulder blades and mid-back.",
      "Pause on any tight spots and let your upper back extend over the roller.",
    ],
  },
  {
    muxPlaybackId: "dRSjul02kKVVbyeINy01tiLnRhEewriwirRnvWUhamy02o",
    name: "Forearm Manual Release",
    targetArea: "wrists",
    duration: 45,
    description: "Hands-on relief for forearms tired from typing and mouse work. Use your thumb to work through the muscles that drive your fingers and wrist.",
    steps: [
      "Rest one forearm on your desk or thigh, palm up.",
      "With the opposite thumb, press into the forearm muscles near the elbow.",
      "Work slowly down towards the wrist, pausing on tender spots.",
      "Turn the palm down and repeat along the top of the forearm, then switch arms.",
    ],
  },
  {
    muxPlaybackId: "Oe01iLfFu23ZcH9nAiwEm00UXWr148RENHYR8y02rlgzB8",
    name: "Half-Kneeling Hip Flexor Stretch",
    targetArea: "hips",
    duration: 30,
    description: "The classic antidote to sitting. Lengthens the hip flexors at the front of the hip that shorten and tighten through a desk day.",
    steps: [
      "Kneel on one knee with the other foot flat in front, both knees at 90 degrees.",
      "Tuck your tailbone under and gently squeeze the glute of the kneeling side.",
      "Shift your hips forward slightly until you feel a stretch at the front of the hip.",
      "Keep your torso tall throughout, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "dCehgwUVJbhRhjY1kdtPfEMkzRgkXt1WShZbAPDILTI",
    name: "Half-Kneeling Wall Rotations",
    targetArea: "upper_back",
    duration: 40,
    description: "Restores rotation through the mid-back, the movement most lost to desk posture. The wall keeps your hips honest so the spine does the turning.",
    steps: [
      "Set up half-kneeling side-on to a wall, inside knee down, hips square.",
      "Reach both arms out in front at shoulder height, palms together.",
      "Rotate your torso and outside arm away from the wall, following your hand with your eyes.",
      "Return with control, repeat, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "iz8GfPOzb4012Ny6MEh3lI5N02s5IuI2AXlsZdoHaNqFo",
    name: "Half-Kneeling Quad Stretch",
    targetArea: "hips",
    duration: 30,
    description: "Targets the quads and the front of the hip together, easing the pull that sitting places on your knees and lower back.",
    steps: [
      "Set up half-kneeling, one knee down and the other foot flat in front.",
      "Hold a wall or chair with the opposite hand for balance.",
      "Reach back with your free hand, take hold of the back foot and draw it towards your bum.",
      "Keep your tailbone tucked, hold the stretch down the front of the thigh, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "beM3Xwh1xra91V2Is7BjQgO02AwUB9cehFr94q9DLdnM",
    name: "Table Top Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "Opens the chest and the front of the shoulders while waking up the back of the body, reversing the rounded desk position in one move.",
    steps: [
      "Sit with your hands behind you on the floor or chair, fingers pointing away.",
      "Press through your hands and lift your hips towards table height.",
      "Open your chest to the ceiling and let your shoulders stretch.",
      "Lower with control and repeat.",
    ],
  },
  {
    muxPlaybackId: "PKRDQIB41z6EIdWDFARnV6faMliWPXlj9fYNot00RDQM",
    name: "Standing Wall Slides",
    targetArea: "shoulder",
    duration: 40,
    description: "Retrains the shoulder blades to move well overhead, undoing hours of arms-forward work at a keyboard.",
    steps: [
      "Stand with your back against a wall, forearms on the wall in a goalpost shape.",
      "Keep your ribs down and lower back gently towards the wall.",
      "Slide your arms up the wall as far as you can without arching.",
      "Slide back down with control and repeat.",
    ],
  },
  {
    muxPlaybackId: "2QfEFACXdCYth02eIYD0200KJ4QHO9MgB1msbmWUrGcVT00",
    name: "Standing Single-Leg Hinge Stretch",
    targetArea: "hips",
    duration: 30,
    description: "A standing hamstring stretch you can do without leaving your desk. Hinging at the hip keeps the stretch where it belongs.",
    steps: [
      "Place one heel forward on the floor, leg straight, toes pulled up.",
      "Keep your back flat and hinge at the hips, sitting slightly back.",
      "Fold forward until you feel a stretch down the back of the front thigh.",
      "Hold, then switch legs.",
    ],
  },
  {
    muxPlaybackId: "s01KMlaP293dU6EtmE00OuHwIiCMnbgoIQQCFDjdlOzVA",
    name: "Standing Glute Stretch",
    targetArea: "hips",
    duration: 30,
    description: "A figure-four stretch for the deep hip muscles that stiffen with sitting, done standing so it fits anywhere in your day.",
    steps: [
      "Stand tall and cross one ankle over the opposite thigh, just above the knee.",
      "Hold something stable for balance if needed.",
      "Sit your hips back and down until you feel a stretch in the outside of the hip.",
      "Keep your chest up, hold, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "DO8ZCDTanbJIje602ICs6u002VHa6jPF4LlD01XsEu9KlE",
    name: "Standing Desk Overhead Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "Uses your desk to take the arms into an overhead position, stretching the shoulders and arms without leaving your workstation.",
    steps: [
      "Stand facing your desk, about an arm's length away.",
      "Place both hands on the desk with your arms straight.",
      "Hinge at the hips and let your chest sink between your arms, taking them overhead.",
      "Hold the stretch through your shoulders and arms, breathing slowly.",
    ],
  },
  {
    muxPlaybackId: "AKzeR3vL8722zj2Y9vAVJ55UQjnHeJMaM01y2u8LMQeE",
    name: "Standing Pec Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "A single-arm chest opener against a wall. Opens the pec muscles that pull your shoulders forward at a desk.",
    steps: [
      "Stand next to a wall and place one forearm against it, elbow at shoulder height.",
      "Keep the forearm pressed into the wall.",
      "Turn your body slowly away from the wall until you feel the stretch across your chest.",
      "Hold and breathe, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "1IzF9cLRSEHKVOUdsKq2OU65cinZQ2cb01m3iPO4qaxg",
    name: "Seated T-Spine Rotations with Roller",
    targetArea: "upper_back",
    duration: 40,
    description: "Rotation work for the mid-back you can do in your chair. The roller between your knees keeps the hips still so the spine does the moving.",
    steps: [
      "Sit tall with a foam roller or cushion held between your knees.",
      "Cross your arms over your chest or place hands behind your head.",
      "Rotate your torso to one side as far as comfortable, keeping knees pressed together.",
      "Return to centre and alternate sides with control.",
    ],
  },
  {
    muxPlaybackId: "kdWczC7whrxIsdqwl2500x1kW1wZrRyIv6SQyuFVnwTI",
    name: "Standing Desk Quad Stretch",
    targetArea: "hips",
    duration: 30,
    description: "A quick quad stretch using your desk for balance. Eases the front of the thigh and takes pressure off the knees and lower back.",
    steps: [
      "Stand side-on to your desk and hold it for balance.",
      "Bend one knee and take hold of that ankle behind you.",
      "Keep knees close together and tuck your tailbone under.",
      "Hold the stretch down the front of the thigh, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "baq4VuDFwbgMbZUO012fbwltdINPyU00BEAVXJs1TOoR8",
    name: "Standing Desk Hamstring Stretch",
    targetArea: "hips",
    duration: 30,
    description: "Uses your desk to support a clean hamstring stretch. Great for tight legs after a morning of back-to-back sitting.",
    steps: [
      "Face your desk and place one heel up on it, or on a lower surface if needed.",
      "Keep both hips facing forward and the standing knee soft.",
      "Hinge gently at the hips towards the raised leg, back flat.",
      "Hold the stretch behind the thigh, then switch legs.",
    ],
  },
  {
    muxPlaybackId: "c8dZMsFeGgf5bnxc3Tv3NdsrjGaiBE3nKX028EELYyTs",
    name: "Seated Trap Stretch",
    targetArea: "neck",
    duration: 30,
    description: "Direct relief for the upper traps, the muscles that carry desk tension and creep towards your ears through the day.",
    steps: [
      "Sit tall and drop one ear towards the same shoulder.",
      "Rest the hand on that side gently on top of your head for a little extra weight.",
      "Let the opposite shoulder stay heavy and relaxed.",
      "Hold, breathe, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "hrFfCLCMKlDDHeYPjz028ab01LVspEB1wSPfkc7krtPIw",
    name: "Seated Single-Leg Hinge Stretch",
    targetArea: "hips",
    duration: 30,
    description: "A hamstring stretch that never requires leaving your chair. Hinge from the hips to keep the stretch in the leg, not the lower back.",
    steps: [
      "Sit near the front edge of your chair and straighten one leg, heel on the floor.",
      "Pull the toes of the straight leg up towards you.",
      "Keep your back flat and hinge forward from the hips.",
      "Hold the stretch behind the thigh, then switch legs.",
    ],
  },
  {
    muxPlaybackId: "SiRfBTIMniBPyYlsh01SMK1cxvJ00OAkHOQwbhe9H02y7s",
    name: "Seated Lacrosse Ball Pec",
    targetArea: "shoulder",
    duration: 45,
    description: "Seated soft-tissue work for the chest. Press the ball into the pec by hand and let arm movement do the releasing.",
    steps: [
      "Sit tall and hold a lacrosse ball against your chest, just inside the shoulder.",
      "Press the ball into the muscle with your opposite hand.",
      "Slowly move the arm on that side to work the tissue under the ball.",
      "Pause on tender spots, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "4no3g2UxmQM7EEKjcPn02pePSHqodBLyKrKW02QRuDfEQ",
    name: "Seated Side Bending Stretch",
    targetArea: "lower_back",
    duration: 30,
    description: "Lengthens the muscles down the side of your trunk and waist, an area that quietly stiffens when you sit still for hours.",
    steps: [
      "Sit tall with feet flat on the floor.",
      "Reach one arm overhead and lean smoothly to the opposite side.",
      "Keep both sit bones planted on the chair.",
      "Feel the stretch down your side, hold, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "svW402gMVH7mwsgjb4YtkZbz02HYUNWxXsvzYujKAW1uc",
    name: "Seated Shoulder Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "Opens the front of the shoulders and arms from your chair, using the chair itself for the stretch.",
    steps: [
      "Sit tall towards the front of your chair.",
      "Interlock your hands behind the chair back.",
      "Lift your chest up and forward, letting the shoulders open.",
      "Feel the stretch across the front of the shoulders and arms, and breathe.",
    ],
  },
  {
    muxPlaybackId: "LYHelSLqCL40100ypS66jS9nOVE9hOciBOP2TJ3CrjTSA",
    name: "Seated Glute Stretch",
    targetArea: "hips",
    duration: 30,
    description: "The figure-four stretch from your chair. Reaches the deep hip rotators that sitting compresses but never lengthens.",
    steps: [
      "Sit tall and cross one ankle over the opposite thigh.",
      "Let the raised knee relax towards the floor.",
      "Hinge forward from the hips with a flat back until you feel the stretch in your hip.",
      "Hold and breathe, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "M6JTUj7G01kGFYH2o81I2E2Io37EJ8Co00nf24S5DCvLM",
    name: "Seated Foam Roller Full Nelson Stretch",
    targetArea: "upper_back",
    duration: 30,
    description: "Thoracic extension over a foam roller from a seated position. Opens the chest and restores extension through the mid-back.",
    steps: [
      "Sit with the foam roller behind your upper back, along the t-spine.",
      "Place your hands behind your head.",
      "Extend your upper back around the roller, pushing your chest forward.",
      "Drive your elbows back, hold, and breathe.",
    ],
  },
  {
    muxPlaybackId: "skys3NaoqnD7h800U02SSvdBs7Lu5O01Css6O98eKX8Qw4",
    name: "Seated Forward Bend Stretch",
    targetArea: "lower_back",
    duration: 30,
    description: "A calming fold from the chair that gently decompresses the lower back and lets the whole posterior chain relax.",
    steps: [
      "Sit near the edge of your chair with feet wider than hips.",
      "Slowly fold forward, letting your torso rest between your thighs.",
      "Let your arms and head hang heavy.",
      "Breathe slowly, then roll up one vertebra at a time.",
    ],
  },
  {
    muxPlaybackId: "z149TG2zqf8pKz01ECuRNwCgZlw3sq01sCzrgdYoxfPko",
    name: "Seated Full Nelson Stretch",
    targetArea: "upper_back",
    duration: 30,
    description: "Opens the chest and upper back straight from your chair, reversing the rounded position that builds up over screen time.",
    steps: [
      "Sit tall and place your hands behind your head.",
      "Push your chest forward.",
      "Drive your elbows back, opening across the chest and upper back.",
      "Hold and breathe steadily.",
    ],
  },
  {
    muxPlaybackId: "1qKN02KWAz9JhCjpxfoLF8rdsq00PYXy2cZxuL1rufOlU",
    name: "Lacrosse Ball Lower Back",
    targetArea: "lower_back",
    duration: 60,
    description: "Targeted floor-based pressure for the muscles either side of the lower spine. Your bodyweight controls the intensity.",
    steps: [
      "Lie on the floor with knees bent and place the ball under your lower back, beside the spine, never on it.",
      "Let your weight settle onto the ball with as much pressure as feels productive.",
      "Shift gently to roll the ball through the muscle.",
      "Pause on tender spots, then work the other side.",
    ],
  },
  {
    muxPlaybackId: "f6fOshT01102XiJSKnmo57HQG02j7ry1yn01rYSSji7Nim8",
    name: "Seated Banded Chest & Shoulder Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "A held band stretch for the chest and shoulders, like a shoulder dislocate paused at the point of stretch. Arms stay straight throughout.",
    steps: [
      "Sit tall holding a band in front of you with both hands, wider than shoulder width.",
      "With straight arms, take the band up and over until it sits behind your upper back and shoulders.",
      "Hold that position, arms straight throughout, chest open.",
      "Breathe steadily, then bring the band back over with control.",
    ],
  },
  {
    muxPlaybackId: "TWu2Ue01SSLNmsJ02dqIPGs02z9Flba4s009wAuZSlY54Ew",
    name: "Lacrosse Ball Hand",
    targetArea: "wrists",
    duration: 45,
    description: "Releases the small muscles of the palm that grip a mouse all day. Pressure from the ball, movement from the hand.",
    steps: [
      "Hold a lacrosse ball in one hand and press it into the palm of the other.",
      "Work the ball into different parts of the palm and base of the fingers.",
      "While pressing, open and close the hand and spread the fingers to create movement.",
      "Pause on tender spots, then switch hands.",
    ],
  },
  {
    muxPlaybackId: "2slJeJTX5vrOkamZbogJO9RIadlIXXdD8PCmzltvqnE",
    name: "Lacrosse Ball Hamstring",
    targetArea: "hips",
    duration: 45,
    description: "Uses your chair to release the hamstrings from directly underneath, right where they compress against the seat all day.",
    steps: [
      "Sit on a firm chair and place the ball under one thigh.",
      "Let your leg weight settle onto the ball.",
      "Slowly straighten and bend the knee to work the tissue.",
      "Move the ball along the hamstring, then switch legs.",
    ],
  },
  {
    muxPlaybackId: "9ZSM8AmNAa5iWuSSWbECpiSpH026HD1gwgxA8VLuwfV4",
    name: "Seated Erector Stretch",
    targetArea: "lower_back",
    duration: 30,
    description: "Lengthens the muscles up one side of the spine at a time, easing that compressed end-of-day feeling.",
    steps: [
      "Sit with feet flat and hip-width apart.",
      "Lean to one side and fold down towards the floor.",
      "Hold there, feeling the stretch up that side of your lower back.",
      "Rise slowly, then repeat on the other side.",
    ],
  },
  {
    muxPlaybackId: "a3Hf5ahK00Ibbos1HE118Wp01A2rtYKDsyd4hIrofWOqw",
    name: "Hand Mobilisation",
    targetArea: "wrists",
    duration: 45,
    description: "Pressure-point release for the hand using something every desk has: a whiteboard marker. Works the palm and thumb where typing tension collects.",
    steps: [
      "Hold a whiteboard marker in one hand.",
      "Press the end of it into different parts of the opposite palm.",
      "Work around the base of the thumb and any tender areas with steady pressure.",
      "Cover the whole hand, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "WvGe7cYZQydFT8b00ja01SSdvhjvsqyCV732GqVI3gLcw",
    name: "Lacrosse Ball Quad",
    targetArea: "hips",
    duration: 60,
    description: "Deep pressure for the front of the thigh, best done at your desk against the chair edge or standing against a surface.",
    steps: [
      "Sitting, press the ball into the front of your thigh with both hands.",
      "Work slowly up and down the quad with firm, comfortable pressure.",
      "Pause on tender spots and slowly bend and straighten the knee.",
      "Cover the full thigh, then switch legs.",
    ],
  },
  {
    muxPlaybackId: "a3Bk3jqBc8gaGfjKicb7mDzOWPdABWlxvXvP004SfBK8",
    name: "Lacrosse Ball Neck",
    targetArea: "neck",
    duration: 45,
    description: "Careful, controlled pressure for the side of the neck where screen tension gathers. Done seated, with your own hand controlling the pressure.",
    steps: [
      "Sit tall and hold a lacrosse ball in one hand.",
      "Press it gently into the muscles along the side of your neck.",
      "Pause on tender areas, adding slow head tilts or turns to work the spot.",
      "Keep it gentle throughout, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "EuplmNrTP5x901rEUYg4N5qBV84IgtxyGj98hyive4NE",
    name: "Kneeling Forearm Stretches",
    targetArea: "wrists",
    duration: 40,
    description: "Stretches both sides of the forearms using the floor for leverage, ideal after heavy typing days.",
    steps: [
      "Kneel and place your palms flat on the floor, fingers pointing towards your knees.",
      "Lean back gently until you feel a stretch through the inner forearms.",
      "Then flip your hands, backs of the hands down, fingers towards you.",
      "Lean back gently again to stretch the outer forearms.",
    ],
  },
  {
    muxPlaybackId: "OwS1lnt8ponoxZKjbNDCdkG9spBevQChxw00PGPgFwlQ",
    name: "Lacrosse Ball Foot",
    targetArea: "hips",
    duration: 45,
    description: "Rolls out the base of the foot, easing the whole posterior chain from the ground up. Do it shoeless under your desk.",
    steps: [
      "Sit or stand and place a lacrosse ball under one foot.",
      "Roll slowly from heel to toes with steady pressure.",
      "Pause on tender spots and breathe.",
      "Spend equal time on each foot.",
    ],
  },
  {
    muxPlaybackId: "XrfvLAkbx4lM6eyGFySeDfm6NCMdvMrhRviSELZfYoA",
    name: "Lacrosse Ball Forearm",
    targetArea: "wrists",
    duration: 45,
    description: "Desk-friendly release for the forearm muscles that do the real work of typing and clicking.",
    steps: [
      "Rest your forearm on the desk, palm up, with the ball underneath.",
      "Press down gently with the other hand for extra pressure.",
      "Roll slowly from elbow to wrist, pausing on tight spots.",
      "Turn the palm down and repeat, then switch arms.",
    ],
  },
  {
    muxPlaybackId: "dOFDJaGB599VWPtZK00IXYu1FX028MMk4PhcE0002gwkr02Y",
    name: "Kneeling Bicep & Shoulder Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "An underrated stretch for the biceps and the front of the shoulder, muscles that shorten with arms resting forward on a desk.",
    steps: [
      "Kneel with your back to a bench or chair.",
      "Reach both arms behind and place your palms on the surface, fingers away.",
      "Sink your hips down gently until you feel a stretch through the front of the shoulders and arms.",
      "Hold, breathe, and ease out slowly.",
    ],
  },
  {
    muxPlaybackId: "UDeCbhqbaOkaUStMkpOq44rYQb01RHGDpfHKTHem00ajg",
    name: "Kneeling Overhead Stretch",
    targetArea: "upper_back",
    duration: 30,
    description: "Opens the lats and mid-back with the floor as support, restoring the overhead reach that desk work steadily erodes.",
    steps: [
      "Kneel and place both hands on a chair or low surface in front of you.",
      "Walk your hands forward and sink your chest towards the floor.",
      "Keep hips over knees and let the mid-back lengthen.",
      "Hold and breathe into your upper back.",
    ],
  },
  {
    muxPlaybackId: "H23YFCfoZkiFNV01j5KW01i6pfZvgdQ5KfM2oni1n5qX00",
    name: "Kneeling Pec Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "A chest opener using your desk for support. One arm at a time, deep and controlled.",
    steps: [
      "Kneel beside your desk and place one forearm on it, elbow roughly at shoulder height.",
      "Keep your hips over your knees.",
      "Sink your chest down and gently away from the supported arm.",
      "Feel the stretch across the chest, hold, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "Q6FXOQb9ISZ9UK2GMpKcWd0102n1O58UMqu2sdDEX1faQ",
    name: "Half-Kneeling Wall Sweeps",
    targetArea: "upper_back",
    duration: 40,
    description: "A flowing arm sweep along the wall that combines shoulder mobility with mid-back rotation in one smooth pattern.",
    steps: [
      "Set up half-kneeling with your side against a wall.",
      "Place the wall-side hand on the wall in front of you at shoulder height.",
      "Sweep the arm slowly up and over along the wall, following it with your eyes.",
      "Return along the same path, repeat, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "qlQMhqk4UGHj8fSP9WF1Hhml01IkwRCoIOpoD4Io027mg",
    name: "Foam Roller Thread The Needle",
    targetArea: "upper_back",
    duration: 40,
    description: "Rotation for the mid-back with the roller guiding the movement, easing stiffness between the shoulder blades.",
    steps: [
      "Start on all fours with a foam roller to one side.",
      "Place the back of one hand on the roller and slide it away as you rotate.",
      "Let your shoulder and head lower towards the floor as the roller glides.",
      "Return with control, repeat, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "PQwr01wO5Y6d5YeV1hxA00WgDzONY3v00zf1A02SDeShXTg",
    name: "Foam Roller Overhead Stretch",
    targetArea: "upper_back",
    duration: 30,
    description: "Rolls the arms out into a deep overhead position from all fours, opening the lats and mid-back that hunch over a keyboard.",
    steps: [
      "Start on all fours with a foam roller on the floor in front of you.",
      "Place both hands on the roller.",
      "Push the roller forward until your arms reach an overhead position.",
      "Hold the stretch, return with control, and repeat.",
    ],
  },
  {
    muxPlaybackId: "faaIPtYNo1GilRM4KoNf5x02XydoR2z1Qa638twGxVN00",
    name: "Banded Shoulder Internal Rotation Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "Restores internal rotation, the shoulder motion most people lose first. A band adds gentle assistance behind the back.",
    steps: [
      "Hold a band behind your back, top hand over the shoulder, bottom hand behind the waist.",
      "Gently pull upward with the top hand to guide the lower arm up your back.",
      "Move to a comfortable stretch, never pain.",
      "Hold, release slowly, then switch arms.",
    ],
  },
  {
    muxPlaybackId: "R4tD6oE4m4m4lol01iJsz01OpF21302oLjPSxDShx66pKg",
    name: "Doorway Pec Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "The doorway does the work: both arms on the frame, step through, and the chest opens. A reliable reset on the way to every coffee refill.",
    steps: [
      "Stand in a doorway with both forearms on the frame, elbows at shoulder height.",
      "Step one foot forward through the doorway.",
      "Let your chest move through until you feel the stretch across the front.",
      "Hold and breathe steadily.",
    ],
  },
  {
    muxPlaybackId: "GW7N9XUAarkGqSwc5kClwPcwXuoKVnGUH8FMTPLPLAg",
    name: "Doorway Rotation Stretch",
    targetArea: "upper_back",
    duration: 30,
    description: "A single-side stretch using the door frame for leverage, reaching across the body to open the upper back.",
    steps: [
      "Stand sideways on to a door frame, feet planted hip-width apart.",
      "Reach the arm furthest from the frame across your body and hold the frame.",
      "Pull gently against the frame, letting the stretch build through your upper back.",
      "Hold, release with control, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "bChIpqcTxWq3bPg5ibvGMrvbFDMMQBQgYVzCLLmtTho",
    name: "Couch Stretch",
    targetArea: "hips",
    duration: 45,
    description: "The deepest hip flexor and quad stretch in the toolbox. Use a wall, chair or actual couch, and go in gradually.",
    steps: [
      "Kneel with one shin vertical against a wall or couch edge, other foot forward.",
      "Tuck your tailbone and squeeze the glute on the back leg.",
      "Raise your torso as upright as comfortable.",
      "Breathe through the stretch, then switch sides.",
    ],
  },
  {
    muxPlaybackId: "BH3xmnjH3erMF6Vw8tyDezKNTf8Hr9EZqVcn1Tp5bl8",
    name: "Cat Cow",
    targetArea: "lower_back",
    duration: 40,
    description: "Slow, wave-like movement through the whole spine. The simplest way to remind your back what moving feels like after sitting still.",
    steps: [
      "Start on all fours, hands under shoulders, knees under hips.",
      "Inhale as you drop your belly and lift your chest and tailbone.",
      "Exhale as you round your spine and tuck your chin and tailbone.",
      "Flow slowly between the two with your breath.",
    ],
  },
  {
    muxPlaybackId: "mtSzrih4nXezcBlmNs01iSfbS4metNNlpMwmVgqtQLXc",
    name: "Chair Single-Leg Hamstring Stretch",
    targetArea: "hips",
    duration: 30,
    description: "Prop a heel on your chair for a supported hamstring stretch with easy control over depth.",
    steps: [
      "Stand facing your chair and place one heel on the seat.",
      "Keep both hips square and the standing knee soft.",
      "Hinge forward from the hips with a flat back.",
      "Hold the stretch behind the thigh, then switch legs.",
    ],
  },
  {
    muxPlaybackId: "n9Uk01tB3CQKYje3YBzR4kcjOUG4HTaTcsrYaoGCmI7Y",
    name: "Doorway Lat Stretch",
    targetArea: "upper_back",
    duration: 30,
    description: "A single-arm hanging stretch off a door frame that reaches the lats, the big muscles connecting desk-bound shoulders to a stiff back.",
    steps: [
      "Hold a door frame with one hand at about hip height.",
      "Sit your hips back and away from the frame, arm straight.",
      "Let your head drop and feel the stretch down that side of your back.",
      "Shift your hips slightly to explore the stretch, then switch arms.",
    ],
  },
  {
    muxPlaybackId: "7nvAvJkZBtFNYcXYo8spc1TRqBsWG01V3I92cQOdrRCg",
    name: "Banded Overhead Triceps Stretch",
    targetArea: "shoulder",
    duration: 30,
    description: "A band-assisted stretch for the triceps and the often-neglected overhead position, with your foot anchoring the band.",
    steps: [
      "Stand on one end of the band to anchor it under your foot.",
      "Hold the other end overhead, letting your hand drop behind your head, elbow pointing up.",
      "Let the band's tension gently deepen the stretch down the back of the arm.",
      "Hold, release slowly, then switch arms.",
    ],
  },
];

export interface MicroResetImportReport {
  totalInSeed: number;
  inserted: number;
  skippedExisting: number;
  skippedByName: Array<string>;
  failed: Array<{ name: string; error: string }>;
  captionRun?: unknown;
}

/**
 * Idempotent bulk insert: skips any seed item whose muxPlaybackId OR name
 * (case-insensitive) is already present in workday_micro_resets — so an
 * environment that already has an older video of the same exercise keeps it
 * rather than gaining a duplicate. Appends the rest after the current highest
 * orderIndex, then (unless skipped) triggers the paced Mux caption backfill.
 */
export async function runMicroResetImport(opts?: { skipCaptions?: boolean }): Promise<MicroResetImportReport> {
  const report: MicroResetImportReport = {
    totalInSeed: MICRO_RESET_SEED.length,
    inserted: 0,
    skippedExisting: 0,
    skippedByName: [],
    failed: [],
  };

  const existing = await db
    .select({ muxPlaybackId: workdayMicroResets.muxPlaybackId, name: workdayMicroResets.name, orderIndex: workdayMicroResets.orderIndex })
    .from(workdayMicroResets);
  const existingIds = new Set(existing.map((r) => r.muxPlaybackId).filter(Boolean));
  const existingNames = new Set(existing.map((r) => (r.name || "").trim().toLowerCase()).filter(Boolean));
  let nextOrder = existing.reduce((max, r) => Math.max(max, r.orderIndex ?? 0), 0) + 1;

  for (const item of MICRO_RESET_SEED) {
    if (existingIds.has(item.muxPlaybackId)) {
      report.skippedExisting++;
      continue;
    }
    if (existingNames.has(item.name.trim().toLowerCase())) {
      report.skippedByName.push(item.name);
      console.log(`[micro-reset-import] skipped "${item.name}" — same name already exists in this database`);
      continue;
    }
    try {
      await db.insert(workdayMicroResets).values({
        name: item.name,
        description: item.description,
        targetArea: item.targetArea,
        exerciseType: "timed",
        duration: item.duration,
        steps: item.steps,
        muxPlaybackId: item.muxPlaybackId,
        orderIndex: nextOrder++,
        isActive: true,
      });
      report.inserted++;
      console.log(`[micro-reset-import] inserted "${item.name}" (${item.targetArea})`);
    } catch (e: any) {
      report.failed.push({ name: item.name, error: String(e?.message || e) });
      console.error(`[micro-reset-import] failed "${item.name}":`, e?.message || e);
    }
  }

  if (!opts?.skipCaptions && report.inserted > 0) {
    try {
      const { runCaptionBackfill } = await import("./muxCaptions");
      report.captionRun = await runCaptionBackfill();
    } catch (e: any) {
      console.error("[micro-reset-import] caption run failed:", e?.message || e);
    }
  }

  return report;
}
