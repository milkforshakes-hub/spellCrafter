import { DEFAULT_SPELL } from "../src/utils/constants.js";
import { normalizeSpell } from "../src/utils/normalizeSpell.js";
import { calculatePower } from "../src/utils/calculatePower.js";
import { evaluatePower } from "../src/utils/powerBands.js";
import { getDeviation, getSpellCraftingDC, getStability } from "../src/utils/spellMath.js";
import { encodeSpellToSpellCode } from "../src/utils/spellCodeEngine.js";
import { decodeSpellCode } from "../src/utils/decodeSpellCode.js";

const spell = normalizeSpell(DEFAULT_SPELL, { preserveDurationConcentration: true });
const power = calculatePower(spell);
const evaluation = evaluatePower(spell.level, power);
const deviation = getDeviation(spell.level, power);
const stability = getStability(spell, power, deviation);
const dc = getSpellCraftingDC(spell, stability, evaluation);
const code = encodeSpellToSpellCode(spell, stability, power, dc);
const decoded = decodeSpellCode(code);

if (!Number.isFinite(power)) throw new Error("Power did not calculate.");
if (!code.includes(":")) throw new Error("SpellCode was not generated.");
if (!decoded || decoded.name !== spell.name) throw new Error("SpellCode round trip failed.");
if (!decoded.classes.includes("Wizard")) throw new Error("Class metadata did not round trip.");

console.log("Smoke test passed", { power, evaluation, stability, dc, codeLength: code.length });
