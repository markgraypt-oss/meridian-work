export interface PacingOption {
  name: string;
  weeklyMinKg: number;
  weeklyMidKg: number;
  weeklyMaxKg: number;
  monthlyMinKg: number;
  monthlyMidKg: number;
  monthlyMaxKg: number;
  weeksFastEstimate: number;
  weeksMidEstimate: number;
  weeksSlowEstimate: number;
  monthsFastEstimate: number;
  monthsMidEstimate: number;
  monthsSlowEstimate: number;
}

export interface WeightLossPlan {
  startWeight: number;
  goalWeight: number;
  totalToLose: number;
  aggressive: PacingOption;
  moderate: PacingOption;
  lifestyleFriendly: PacingOption;
}

const WEEKS_PER_MONTH = 4.33;

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function calculatePacingOption(
  name: string,
  startWeight: number,
  lossNeeded: number,
  minPercent: number,
  midPercent: number,
  maxPercent: number
): PacingOption {
  const weeklyMinKg = roundToOneDecimal((startWeight * minPercent) / 100);
  const weeklyMidKg = roundToOneDecimal((startWeight * midPercent) / 100);
  const weeklyMaxKg = roundToOneDecimal((startWeight * maxPercent) / 100);

  const monthlyMinKg = roundToOneDecimal(weeklyMinKg * WEEKS_PER_MONTH);
  const monthlyMidKg = roundToOneDecimal(weeklyMidKg * WEEKS_PER_MONTH);
  const monthlyMaxKg = roundToOneDecimal(weeklyMaxKg * WEEKS_PER_MONTH);

  const weeksFastEstimate = roundToHalf(lossNeeded / weeklyMaxKg);
  const weeksMidEstimate = roundToHalf(lossNeeded / weeklyMidKg);
  const weeksSlowEstimate = roundToHalf(lossNeeded / weeklyMinKg);

  const monthsFastEstimate = roundToOneDecimal(weeksFastEstimate / WEEKS_PER_MONTH);
  const monthsMidEstimate = roundToOneDecimal(weeksMidEstimate / WEEKS_PER_MONTH);
  const monthsSlowEstimate = roundToOneDecimal(weeksSlowEstimate / WEEKS_PER_MONTH);

  return {
    name,
    weeklyMinKg,
    weeklyMidKg,
    weeklyMaxKg,
    monthlyMinKg,
    monthlyMidKg,
    monthlyMaxKg,
    weeksFastEstimate,
    weeksMidEstimate,
    weeksSlowEstimate,
    monthsFastEstimate,
    monthsMidEstimate,
    monthsSlowEstimate,
  };
}

export function calculateWeightLossPlan(startWeight: number, goalWeight: number): WeightLossPlan {
  const totalToLose = roundToOneDecimal(startWeight - goalWeight);

  const aggressive = calculatePacingOption(
    "Aggressive",
    startWeight,
    totalToLose,
    0.9,   // min
    1.15,  // mid
    1.4    // max
  );

  const moderate = calculatePacingOption(
    "Moderate",
    startWeight,
    totalToLose,
    0.6,   // min
    0.75,  // mid
    0.9    // max
  );

  const lifestyleFriendly = calculatePacingOption(
    "Lifestyle Friendly",
    startWeight,
    totalToLose,
    0.3,   // min
    0.45,  // mid
    0.6    // max
  );

  return {
    startWeight,
    goalWeight,
    totalToLose,
    aggressive,
    moderate,
    lifestyleFriendly,
  };
}

/*
EXAMPLE OUTPUT:
Using startWeight = 100 and goalWeight = 75:

{
  startWeight: 100,
  goalWeight: 75,
  totalToLose: 25,
  aggressive: {
    name: "Aggressive",
    weeklyMinKg: 0.9,      // 100 * 0.9% = 0.9kg
    weeklyMidKg: 1.2,      // 100 * 1.15% = 1.15kg → 1.2
    weeklyMaxKg: 1.4,      // 100 * 1.4% = 1.4kg
    monthlyMinKg: 3.9,     // 0.9 * 4.33 = 3.9kg
    monthlyMidKg: 5.2,     // 1.2 * 4.33 = 5.2kg
    monthlyMaxKg: 6.1,     // 1.4 * 4.33 = 6.06kg → 6.1kg
    weeksFastEstimate: 18, // 25 / 1.4 = 17.86 → 18 weeks
    weeksMidEstimate: 21.5,// 25 / 1.2 = 20.83 → 21 weeks
    weeksSlowEstimate: 28, // 25 / 0.9 = 27.78 → 28 weeks
    monthsFastEstimate: 4.2,
    monthsMidEstimate: 5,
    monthsSlowEstimate: 6.5
  },
  moderate: {
    name: "Moderate",
    weeklyMinKg: 0.6,
    weeklyMidKg: 0.8,      // 100 * 0.75% = 0.75kg → 0.8
    weeklyMaxKg: 0.9,
    monthlyMinKg: 2.6,
    monthlyMidKg: 3.5,
    monthlyMaxKg: 3.9,
    weeksFastEstimate: 28,
    weeksMidEstimate: 31.5,
    weeksSlowEstimate: 41.5,
    monthsFastEstimate: 6.5,
    monthsMidEstimate: 7.3,
    monthsSlowEstimate: 9.6
  },
  lifestyleFriendly: {
    name: "Lifestyle Friendly",
    weeklyMinKg: 0.3,
    weeklyMidKg: 0.5,      // 100 * 0.45% = 0.45kg → 0.5
    weeklyMaxKg: 0.6,
    monthlyMinKg: 1.3,
    monthlyMidKg: 2.2,
    monthlyMaxKg: 2.6,
    weeksFastEstimate: 41.5,
    weeksMidEstimate: 50,
    weeksSlowEstimate: 83.5,
    monthsFastEstimate: 9.6,
    monthsMidEstimate: 11.5,
    monthsSlowEstimate: 19.3
  }
}
*/
