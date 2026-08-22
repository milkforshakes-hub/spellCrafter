import { useEffect, useMemo, useRef, useState } from "react";
import PowerChart from "./PowerChart.jsx";
import {
  AREAS,
  ATTACK_SAVE_TYPES,
  CASTING_TIMES,
  CLASS_OPTIONS,
  DEFAULT_SPELL,
  DURATIONS,
  EFFECT_OPTIONS,
  EMOTIONAL_TONES,
  MATERIAL_TYPES,
  RANGES,
  SOURCE_TYPES,
  SPELL_SCHOOLS,
  THEME_OPTIONS,
} from "../utils/constants.js";
import { calculatePower, explainPower } from "../utils/calculatePower.js";
import { decodeSpellCode } from "../utils/decodeSpellCode.js";
import { getPowerModel, POWER_MODELS } from "../utils/experimentalPower.js";
import { encodeSpellToSpellCode } from "../utils/spellCodeEngine.js";
import { evaluatePower, getPowerBands } from "../utils/powerBands.js";
import {
  formatDeviationAsPercent,
  formatStabilityAsPercent,
  getDeviation,
  getSpellCraftingDC,
  getStability,
} from "../utils/spellMath.js";
import { normalizeNumber, normalizeSpell } from "../utils/normalizeSpell.js";
import {
  deleteArchivedSpell,
  exportJson,
  loadArchive,
  loadDraft,
  readJsonFile,
  saveDraft,
  upsertArchivedSpell,
} from "../utils/spellStorage.js";

function Section({ eyebrow, title, children, right }) {
  return (
    <section className="section-card">
      <div className="section-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function TextInput({ label, hint, ...props }) {
  return (
    <Field label={label} hint={hint}>
      <input {...props} />
    </Field>
  );
}

function SelectInput({ label, hint, options, ...props }) {
  return (
    <Field label={label} hint={hint}>
      <select {...props}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </Field>
  );
}

function TextArea({ label, hint, ...props }) {
  return (
    <Field label={label} hint={hint}>
      <textarea {...props} />
    </Field>
  );
}

function Toggle({ label, checked, onChange, hint }) {
  return (
    <button type="button" className={`toggle ${checked ? "active" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span className="toggle-knob" />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </button>
  );
}

function ChipGroup({ options, selected, onToggle, max, compact = false }) {
  return (
    <div className={`chip-grid ${compact ? "compact" : ""}`}>
      {options.map((option) => {
        const isActive = selected.includes(option);
        const disabled = !isActive && max && selected.length >= max && option !== "None";
        return (
          <button
            type="button"
            key={option}
            className={`chip ${isActive ? "selected" : ""}`}
            disabled={disabled}
            onClick={() => onToggle(option)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function MetricTile({ label, value, subtext, tone }) {
  return (
    <div className={`metric-tile tone-${tone || "default"}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {subtext && <small>{subtext}</small>}
    </div>
  );
}

function NoticeList({ items }) {
  if (!items.length) return null;
  return (
    <div className="notice-list" role="status">
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

function formatNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export default function SpellCrafter() {
  const fileInputRef = useRef(null);
  const [spell, setSpell] = useState(() => normalizeSpell(loadDraft() || DEFAULT_SPELL, { preserveDurationConcentration: true }));
  const [archive, setArchive] = useState(() => loadArchive());
  const [spellCodeInput, setSpellCodeInput] = useState("");
  const [status, setStatus] = useState("Ready.");
  const [copied, setCopied] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [rawRandom, setRawRandom] = useState(null);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState("");
  const [powerModelId, setPowerModelId] = useState("official-outlier-aware-v1");

  const metrics = useMemo(() => {
    const normalized = normalizeSpell(spell, { preserveDurationConcentration: true });
    const powerModel = getPowerModel(powerModelId);
    const power = powerModel.calculate(normalized);
    const legacyPower = calculatePower(normalized);
    const evaluation = evaluatePower(normalized.level, power);
    const deviation = getDeviation(normalized.level, power);
    const stability = getStability(normalized, power, deviation);
    const craftingDC = getSpellCraftingDC(normalized, stability, evaluation);
    const spellCode = Number.isFinite(power) ? encodeSpellToSpellCode(normalized, stability, power, craftingDC) : "";
    const bands = getPowerBands(normalized.level);
    const explanation = Number.isFinite(legacyPower) ? explainPower(normalized) : null;
    return { power, legacyPower, powerModel, evaluation, deviation, stability, craftingDC, spellCode, bands, explanation };
  }, [spell, powerModelId]);

  const validation = useMemo(() => {
    const errors = [];
    const warnings = [];
    if (!spell.name.trim()) errors.push("Spell name is required.");
    if (!spell.classes.length) errors.push("Select at least one class.");
    if (!spell.verbal && !spell.somatic && !spell.material) errors.push("A spell needs at least one component.");
    if (spell.material && spell.materialType === "None") warnings.push("Material spells should use Trivial, Costed, or Consumed material type.");
    if (spell.damageSpell && spell.avgRoll <= 0) warnings.push("Damage spell is enabled, but dice/average damage is 0.");
    if (spell.upcastable && !spell.upcastText.trim()) warnings.push("Upcastable is enabled. Add upcast text before exporting.");
    if (spell.hasRestriction && !spell.restrictionText.trim()) warnings.push("Restriction is enabled. Add the casting restriction text.");
    return { errors, warnings };
  }, [spell]);

  const filteredArchive = useMemo(() => {
    const needle = archiveFilter.trim().toLowerCase();
    if (!needle) return archive;
    return archive.filter((entry) => [entry.name, entry.school, entry.author, entry.description, ...(entry.effects || [])].join(" ").toLowerCase().includes(needle));
  }, [archive, archiveFilter]);

  useEffect(() => {
    saveDraft(spell);
  }, [spell]);

  function patchSpell(patch, options = { normalize: true }) {
    setSpell((previous) => {
      const next = typeof patch === "function" ? patch(previous) : { ...previous, ...patch };
      return options.normalize ? normalizeSpell(next, { preserveDurationConcentration: true }) : next;
    });
  }

  function updateField(field, value) {
    patchSpell((previous) => ({ ...previous, [field]: value }));
  }

  function updateCheckbox(field, value) {
    patchSpell((previous) => {
      const next = { ...previous, [field]: value };
      if (field === "material" && !value) {
        next.materialType = "None";
        next.materialCost = 0;
        next.materialText = "";
      }
      if (field === "damageSpell" && !value) next.avgRoll = normalizeNumber(next.diceValue);
      return next;
    });
  }

  function toggleListItem(field, value, max) {
    patchSpell((previous) => {
      const current = Array.isArray(previous[field]) ? previous[field] : [];
      const hasValue = current.includes(value);
      let next = hasValue ? current.filter((item) => item !== value) : [...current, value];
      if (max) next = next.slice(0, max);
      return { ...previous, [field]: next };
    });
  }

  function toggleEffect(value) {
    patchSpell((previous) => {
      if (value === "None") return { ...previous, effects: ["None", "None", "None"] };
      const active = (previous.effects || []).filter((effect) => effect !== "None");
      const next = active.includes(value) ? active.filter((effect) => effect !== value) : [...active, value].slice(0, 3);
      while (next.length < 3) next.push("None");
      return { ...previous, effects: next };
    });
  }

  async function copySpellCode() {
    if (!metrics.spellCode) return;
    await navigator.clipboard.writeText(metrics.spellCode);
    setCopied(true);
    setStatus("SpellCode copied to clipboard.");
    window.setTimeout(() => setCopied(false), 1800);
  }

  function loadFromSpellCode() {
    const decoded = decodeSpellCode(spellCodeInput);
    if (!decoded) {
      setStatus("That SpellCode could not be decoded.");
      return;
    }
    setSpell(decoded);
    setSpellCodeInput("");
    setStatus(`Loaded ${decoded.name} from SpellCode.`);
  }

  function saveCurrentToArchive() {
    const nextArchive = upsertArchivedSpell(spell);
    setArchive(nextArchive);
    setStatus(`${spell.name || "Spell"} saved to archive.`);
  }

  function loadArchived(entry) {
    setSpell(normalizeSpell(entry, { preserveDurationConcentration: true }));
    setStatus(`Loaded ${entry.name || "archived spell"}.`);
  }

  function removeArchived(entry) {
    setArchive(deleteArchivedSpell(entry.id));
    setStatus(`${entry.name || "Archived spell"} removed from archive.`);
  }

  async function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const json = await readJsonFile(file);
      const normalized = normalizeSpell(json, { preserveDurationConcentration: true });
      setSpell(normalized);
      setStatus(`Imported ${normalized.name}.`);
    } catch (error) {
      setStatus("JSON import failed. Check the file format.");
    } finally {
      event.target.value = "";
    }
  }

  async function generateRandomSpell() {
    setLoadingRandom(true);
    setStatus("Generating spell...");
    try {
      const response = await fetch("/api/generate-spell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: Date.now() }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const json = await response.json();
      const normalized = normalizeSpell(json.spell || json, { preserveDurationConcentration: true });
      setRawRandom(json);
      setSpell(normalized);
      setStatus(json.savedAs ? `Generated and catalogued ${normalized.name}.` : `Generated ${normalized.name}.`);
    } catch (error) {
      setStatus(`Random spell failed: ${error.message}`);
    } finally {
      setLoadingRandom(false);
    }
  }

  async function loadNextOfficialSpell() {
    try {
      const response = await fetch("/spellQueue.json");
      if (!response.ok) throw new Error("No spellQueue.json found in public/.");
      const queue = await response.json();
      const index = Number.parseInt(localStorage.getItem("spellCrafter.importIndex") || "0", 10);
      if (!Array.isArray(queue) || !queue.length) throw new Error("spellQueue.json is empty.");
      const nextIndex = index >= queue.length ? 0 : index;
      const normalized = normalizeSpell(queue[nextIndex], { preserveDurationConcentration: true });
      localStorage.setItem("spellCrafter.importIndex", String(nextIndex + 1));
      setSpell(normalized);
      setStatus(`Loaded official spell ${nextIndex + 1} of ${queue.length}: ${normalized.name}.`);
    } catch (error) {
      setStatus(error.message);
    }
  }

  function handleAdminLogin() {
    if (adminMode) {
      setAdminMode(false);
      setStatus("Admin mode disabled.");
      return;
    }
    const expected = import.meta.env.VITE_ADMIN_PASSWORD || "changeme";
    const entered = window.prompt("Enter admin password");
    if (entered === expected) {
      setAdminMode(true);
      setStatus("Admin mode enabled.");
    } else {
      setStatus("Admin password did not match.");
    }
  }

  const activeEffects = (spell.effects || []).filter((effect) => effect !== "None");
  const tone = metrics.evaluation === "Overpowered" ? "red" : metrics.evaluation === "High Power" ? "amber" : metrics.evaluation === "Mid Power" ? "green" : metrics.evaluation === "Low Power" ? "blue" : "purple";

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Thilmorn Academy Arcane Engineering Console</p>
          <h1>Spell Crafter</h1>
          <p className="hero-copy">Design homebrew spells, measure balance, generate SpellCodes, and keep a local archive without losing the knobs that make the system powerful.</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="primary" onClick={generateRandomSpell} disabled={loadingRandom}>{loadingRandom ? "Generating..." : "Random Spell"}</button>
          <button type="button" className="secondary" onClick={() => exportJson(spell)}>Export JSON</button>
          <button type="button" className="secondary" onClick={() => fileInputRef.current?.click()}>Import JSON</button>
          <button type="button" className="ghost" onClick={handleAdminLogin}>{adminMode ? "Exit Admin" : "Admin"}</button>
          <input ref={fileInputRef} hidden type="file" accept="application/json,.json" onChange={importJson} />
        </div>
      </header>

      <NoticeList items={[...validation.errors, ...validation.warnings]} />

      <div className="workbench">
        <div className="editor-column">
          <Section eyebrow="Step 1" title="Spell Identity">
            <div className="form-grid two">
              <TextInput label="Spell name" value={spell.name} onChange={(event) => updateField("name", event.target.value)} placeholder="e.g. Lantern of Returning" />
              <TextInput label="Author" value={spell.author} onChange={(event) => updateField("author", event.target.value)} placeholder="Who made it?" />
              <TextInput label="Level" type="number" min="0" max="9" value={spell.level} onChange={(event) => updateField("level", event.target.value)} hint="0 means cantrip." />
              <SelectInput label="School" value={spell.school} onChange={(event) => updateField("school", event.target.value)} options={SPELL_SCHOOLS} />
            </div>
            <div className="subsection">
              <div className="subsection-title">
                <h3>Classes</h3>
                <span>{spell.classes.length} selected</span>
              </div>
              <ChipGroup options={CLASS_OPTIONS} selected={spell.classes} onToggle={(value) => toggleListItem("classes", value)} compact />
            </div>
          </Section>

          <Section eyebrow="Step 2" title="Effects and Spell Shape">
            <div className="subsection">
              <div className="subsection-title">
                <h3>Effects</h3>
                <span>Choose up to 3</span>
              </div>
              <ChipGroup options={EFFECT_OPTIONS} selected={activeEffects.length ? activeEffects : ["None"]} max={3} onToggle={toggleEffect} compact />
            </div>
            <div className="form-grid two">
              <SelectInput label="Casting time" value={spell.castingTime} onChange={(event) => updateField("castingTime", event.target.value)} options={CASTING_TIMES} />
              <SelectInput label="Range" value={spell.range} onChange={(event) => updateField("range", event.target.value)} options={RANGES} />
              <SelectInput label="Duration" value={spell.duration} onChange={(event) => updateField("duration", event.target.value)} options={DURATIONS} />
              <SelectInput label="Area" value={spell.area} onChange={(event) => updateField("area", event.target.value)} options={AREAS} />
            </div>
          </Section>

          <Section eyebrow="Step 3" title="Components and Limits">
            <div className="toggle-grid">
              <Toggle label="Verbal" checked={spell.verbal} onChange={(value) => updateCheckbox("verbal", value)} hint="Spoken component" />
              <Toggle label="Somatic" checked={spell.somatic} onChange={(value) => updateCheckbox("somatic", value)} hint="Gesture component" />
              <Toggle label="Material" checked={spell.material} onChange={(value) => updateCheckbox("material", value)} hint="Object component" />
              <Toggle label="Concentration" checked={spell.concentration} onChange={(value) => updateCheckbox("concentration", value)} hint="Requires focus" />
              <Toggle label="Ritual" checked={spell.ritual} onChange={(value) => updateCheckbox("ritual", value)} hint="Can be cast slowly" />
              <Toggle label="Upcastable" checked={spell.upcastable} onChange={(value) => updateCheckbox("upcastable", value)} hint="Scales at higher levels" />
              <Toggle label="Restriction" checked={spell.hasRestriction} onChange={(value) => updateCheckbox("hasRestriction", value)} hint="Has a special condition" />
              <Toggle label="Damage spell" checked={spell.damageSpell} onChange={(value) => updateCheckbox("damageSpell", value)} hint="Deals damage" />
            </div>

            {spell.material && (
              <div className="form-grid two inset-panel">
                <SelectInput label="Material type" value={spell.materialType} onChange={(event) => updateField("materialType", event.target.value)} options={MATERIAL_TYPES.filter((type) => type !== "None")} />
                <TextInput label="Material cost (gp)" type="number" min="0" value={spell.materialCost} onChange={(event) => updateField("materialCost", event.target.value)} />
                <TextArea label="Material description" value={spell.materialText} onChange={(event) => updateField("materialText", event.target.value)} placeholder="A silver tuning fork engraved with the caster's sigil..." />
              </div>
            )}

            {spell.upcastable && (
              <TextArea label="Upcast effect" value={spell.upcastText} onChange={(event) => updateField("upcastText", event.target.value)} placeholder="When cast at a higher level..." />
            )}

            {spell.hasRestriction && (
              <TextArea label="Casting restriction" value={spell.restrictionText} onChange={(event) => updateField("restrictionText", event.target.value)} placeholder="Only works under moonlight, while holding a key, etc." />
            )}
          </Section>

          <Section eyebrow="Step 4" title="Combat and Description">
            <div className="form-grid three">
              <SelectInput label="Attack or save" value={spell.attackSave} onChange={(event) => updateField("attackSave", event.target.value)} options={ATTACK_SAVE_TYPES} />
              <TextInput label="Dice rolled" value={spell.diceValue} onChange={(event) => patchSpell((previous) => ({ ...previous, diceValue: event.target.value, avgRoll: normalizeNumber(event.target.value) }))} placeholder="2d6 + 3" hint={`Average: ${spell.avgRoll}`} />
              <TextInput label="Targets" type="number" value={spell.targets} onChange={(event) => updateField("targets", event.target.value)} hint="Use -1 for area/many targets." />
            </div>
            <TextArea label="Spell description" value={spell.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe the spell in official sourcebook style." rows="7" />
          </Section>

          {adminMode && (
            <Section eyebrow="Admin" title="Metadata and Import Tools" right={<button type="button" className="secondary small" onClick={loadNextOfficialSpell}>Load Next Official Spell</button>}>
              <div className="form-grid two">
                <SelectInput label="Emotional tone" value={spell.emotionalTone} onChange={(event) => updateField("emotionalTone", event.target.value)} options={EMOTIONAL_TONES} />
                <SelectInput label="Source type" value={spell.sourceType} onChange={(event) => updateField("sourceType", event.target.value)} options={SOURCE_TYPES} />
                <TextInput label="Version" value={spell.version} onChange={(event) => updateField("version", event.target.value)} />
              </div>
              <div className="subsection">
                <div className="subsection-title">
                  <h3>Themes</h3>
                  <span>{spell.themes.length} selected</span>
                </div>
                <ChipGroup options={THEME_OPTIONS} selected={spell.themes} onToggle={(value) => toggleListItem("themes", value)} compact />
              </div>
            </Section>
          )}
        </div>

        <aside className="metrics-column">
          <section className="panel sticky-panel">
            <div className="spell-card-preview">
              <p className="eyebrow">Live Preview</p>
              <h2>{spell.name || "Untitled Spell"}</h2>
              <p>{spell.level === 0 ? "Cantrip" : `Level ${spell.level}`} {spell.school} spell</p>
              <div className="tag-row">
                {spell.classes.map((cls) => <span key={cls}>{cls}</span>)}
              </div>
            </div>

            <div className="metric-grid">
              <MetricTile label="Power" value={Number.isFinite(metrics.power) ? metrics.power : "Error"} subtext={metrics.evaluation} tone={tone} />
              <MetricTile label="Stability" value={formatStabilityAsPercent(metrics.stability)} subtext="craft reliability" tone="blue" />
              <MetricTile label="Deviation" value={formatDeviationAsPercent(metrics.deviation)} subtext="from expected band" tone="purple" />
              <MetricTile label="Crafting DC" value={metrics.craftingDC} subtext="spellcraft check" tone="green" />
            </div>

            <div className="model-picker">
              <Field label="Power model">
                <select value={powerModelId} onChange={(event) => setPowerModelId(event.target.value)}>
                  {POWER_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>{model.label}</option>
                  ))}
                </select>
              </Field>
              <p>
                <strong>{metrics.powerModel.label}</strong>
                {metrics.powerModel.experimental && ` · experimental · legacy power ${metrics.legacyPower}`}
              </p>
              <small>{metrics.powerModel.description}</small>
            </div>

            <div className="band-summary">
              <strong>Level {spell.level} Bands</strong>
              <span>{metrics.bands.minPower} min</span>
              <span>{metrics.bands.avgDown} low avg</span>
              <span>{metrics.bands.avgUp} high avg</span>
              <span>{metrics.bands.maxPower} max</span>
            </div>

            <PowerChart spellLevel={spell.level} spellPower={Number.isFinite(metrics.power) ? metrics.power : 0} />

            {metrics.explanation && (
              <details className="breakdown">
                <summary>Power calculation breakdown</summary>
                <dl>
                  <div><dt>Base power</dt><dd>{formatNumber(metrics.explanation.basePower)}</dd></div>
                  <div><dt>Component bonus</dt><dd>{formatNumber(metrics.explanation.componentBonus)}</dd></div>
                  <div><dt>Material penalty</dt><dd>{formatNumber(metrics.explanation.materialPenalty)}</dd></div>
                  <div><dt>Concentration penalty</dt><dd>{formatNumber(metrics.explanation.concentrationPenalty)}</dd></div>
                  <div><dt>Target bonus</dt><dd>{formatNumber(metrics.explanation.targetBonus)}</dd></div>
                  <div><dt>Effect bonus</dt><dd>{formatNumber(metrics.explanation.effectBonus)}</dd></div>
                  <div><dt>Roll bonus</dt><dd>{formatNumber(metrics.explanation.rollBonus)}</dd></div>
                  <div><dt>Multiplier</dt><dd>{formatNumber(metrics.explanation.multiplier)}</dd></div>
                </dl>
              </details>
            )}

            <div className="spellcode-box">
              <div className="subsection-title">
                <h3>SpellCode</h3>
                <button type="button" className="secondary small" onClick={copySpellCode} disabled={!metrics.spellCode}>{copied ? "Copied" : "Copy"}</button>
              </div>
              <textarea readOnly value={metrics.spellCode} rows="4" />
              <div className="load-code-row">
                <input value={spellCodeInput} onChange={(event) => setSpellCodeInput(event.target.value)} placeholder="Paste SpellCode to load" />
                <button type="button" className="primary small" onClick={loadFromSpellCode}>Load</button>
              </div>
            </div>

            <div className="archive-panel">
              <div className="subsection-title">
                <h3>Archive</h3>
                <button type="button" className="primary small" onClick={saveCurrentToArchive}>Save</button>
              </div>
              <input className="archive-search" value={archiveFilter} onChange={(event) => setArchiveFilter(event.target.value)} placeholder="Search saved spells" />
              <div className="archive-list">
                {filteredArchive.length === 0 && <p className="empty-state">No saved spells yet.</p>}
                {filteredArchive.map((entry) => (
                  <article key={entry.id || `${entry.name}-${entry.updatedAt}`} className="archive-item">
                    <div>
                      <strong>{entry.name || "Untitled Spell"}</strong>
                      <small>{entry.school} · Level {entry.level}</small>
                    </div>
                    <div className="archive-actions">
                      <button type="button" onClick={() => loadArchived(entry)}>Load</button>
                      <button type="button" onClick={() => removeArchived(entry)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="status-line">{status}</div>
            <button type="button" className="ghost full" onClick={() => setShowDebug((value) => !value)}>{showDebug ? "Hide Debug" : "Show Debug"}</button>
          </section>
        </aside>
      </div>

      {showDebug && (
        <section className="debug-panel">
          <h2>Debug Data</h2>
          <pre>{JSON.stringify({ spell, metrics, rawRandom }, null, 2)}</pre>
        </section>
      )}
    </main>
  );
}
