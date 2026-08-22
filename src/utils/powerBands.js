export function getPowerBands(level) {
  const numericLevel = Math.max(0, Number(level) || 0);
  const minPower = Math.round(6.32 + 13 * numericLevel + 0.163 * numericLevel * numericLevel);
  const avgDown = Math.round(10.47 + 20.27 * numericLevel + 0.741 * numericLevel * numericLevel);
  const avgUp = Math.round(16.87 + 32.9 * numericLevel + 0.977 * numericLevel * numericLevel);
  const maxPower = Math.round(25.5 + 50.9 * numericLevel + 0.871 * numericLevel * numericLevel);
  return { minPower, avgDown, avgUp, maxPower };
}

export function evaluatePower(level, power) {
  if (Number.isNaN(Number(power))) return "ERROR";
  const { minPower, avgDown, avgUp, maxPower } = getPowerBands(level);
  if (power < minPower) return "Underpowered";
  if (power < avgDown) return "Low Power";
  if (power < avgUp) return "Mid Power";
  if (power < maxPower) return "High Power";
  return "Overpowered";
}

export function getBandPosition(level, power) {
  const { minPower, avgDown, avgUp, maxPower } = getPowerBands(level);
  if (power <= minPower) return 0;
  if (power >= maxPower) return 1;
  return (power - minPower) / Math.max(1, maxPower - minPower);
}
