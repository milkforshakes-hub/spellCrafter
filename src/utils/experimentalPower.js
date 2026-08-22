import { calculatePower, explainPower } from "./calculatePower.js";
import { getPowerBands } from "./powerBands.js";

function bandCenteredPower(spell, scale, outsideScale = scale) {
  const originalPower = calculatePower(spell);
  if (!Number.isFinite(originalPower)) return Number.NaN;

  const bands = getPowerBands(spell.level);
  const midPower = (bands.avgDown + bands.avgUp) / 2;
  const isOriginalOutlier = originalPower < bands.minPower || originalPower > bands.maxPower;
  const activeScale = isOriginalOutlier ? outsideScale : scale;
  return Math.round(midPower + (originalPower - midPower) * activeScale);
}

export const POWER_MODELS = [
  {
    id: "legacy",
    label: "Legacy Formula",
    description: "Original SpellCrafter power calculation.",
    experimental: false,
    calculate: calculatePower,
    explain: explainPower,
  },
  {
    id: "official-mid-max-v1",
    label: "Official Mid-Max v1",
    description: "Strong official-corpus calibration. Maximizes Mid Power placement and heavily compresses outliers.",
    experimental: true,
    calculate: (spell) => bandCenteredPower(spell, 0.25),
  },
  {
    id: "official-balanced-v1",
    label: "Official Balanced v1",
    description: "Moderate official-corpus calibration. Keeps more high/low signal while reducing extreme tails.",
    experimental: true,
    calculate: (spell) => bandCenteredPower(spell, 0.35),
  },
  {
    id: "official-outlier-aware-v1",
    label: "Official Outlier-Aware v1",
    description: "Balanced official-corpus calibration that preserves more tail behavior for spells the legacy model already flags as extreme.",
    experimental: true,
    calculate: (spell) => bandCenteredPower(spell, 0.35, 0.75),
  },
  {
    id: "official-gentle-v1",
    label: "Official Gentle v1",
    description: "Light official-corpus calibration. Preserves more of the original formula's spread.",
    experimental: true,
    calculate: (spell) => bandCenteredPower(spell, 0.45),
  },
];

export function getPowerModel(id) {
  return POWER_MODELS.find((model) => model.id === id) || POWER_MODELS[0];
}

export function calculatePowerWithModel(spell, modelId = "legacy") {
  return getPowerModel(modelId).calculate(spell);
}
