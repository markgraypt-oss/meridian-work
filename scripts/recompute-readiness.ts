import { db } from "../server/db";
import { dailyReadinessHistory } from "../shared/schema";
import { gatherInputsForDay, computeDailyReadinessV1 } from "../server/dailyReadiness";

const USER_ID = "admin-001";

async function main() {
  console.log("Recomputing daily readiness for admin-001 (last 30 days)...\n");
  let updated = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const { inputs } = await gatherInputsForDay(USER_ID, dk);
    const result = computeDailyReadinessV1(inputs);
    if (result.score != null) {
      await db
        .insert(dailyReadinessHistory)
        .values({
          userId: USER_ID,
          date: dk,
          sleepInput: inputs.sleep,
          energyInput: inputs.energy,
          trainingLoadInput: inputs.trainingLoad,
          hrvInput: inputs.hrv,
          rhrInput: inputs.rhr,
          inputCount: result.inputCount,
          score: result.score,
          algorithmVersion: "v2",
        })
        .onConflictDoUpdate({
          target: [dailyReadinessHistory.userId, dailyReadinessHistory.date],
          set: {
            sleepInput: inputs.sleep,
            energyInput: inputs.energy,
            trainingLoadInput: inputs.trainingLoad,
            hrvInput: inputs.hrv,
            rhrInput: inputs.rhr,
            inputCount: result.inputCount,
            score: result.score,
            algorithmVersion: "v2",
            updatedAt: new Date(),
          },
        });
      updated++;
    }
  }
  console.log(`Updated ${updated} rows.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
