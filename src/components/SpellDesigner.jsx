// SpellDesigner.jsx
/**
 * SpellDesigner Component
 * A comprehensive UI for creating and managing custom spells with the following features:
 * - Basic spell information input
 * - Effects and traits configuration
 * - Material components management
 * - Power calculations and metrics
 * - Spell saving and archiving system
 * - Admin-only metadata management
 */

// Import statements...
import { calculatePower } from "../utils/calculatePower";
import { evaluatePower } from "../utils/powerBands";
import { getDeviation, getStability, getSpellCraftingDC } from "../utils/spellMath";
import PowerChart  from "./PowerChart";
import { encodeSpellToSpellCode } from '../utils/spellCodeEngine';
import { formatDeviationAsPercent, formatStabilityAsPercent } from "../utils/spellMath";
import React, { useState, useEffect } from "react";
import { decodeSpellCode } from '../utils/decodeSpellCode';
import { SPELL_SCHOOLS, CASTING_TIMES, RANGES, DURATIONS, AREAS, EFFECT_OPTIONS, ATTACK_SAVE_TYPES, MATERIAL_TYPES, evaluationColors, THEME_OPTIONS } from '../utils/constants';
import { normalizeSpell, normalizeNumber } from '../utils/normalizeSpell';



function SpellDesigner() {
  // State for managing spell data

    // Controls admin access and features
    const [adminMode, setAdminMode] = useState(false);

    // Add this with your other state declarations
    const [showClassesDropdown, setShowClassesDropdown] = useState(false);

    // Manages spell code generation and loading
    const [spellCode, setSpellCode] = useState("");
    const [loadInput, setLoadInput] = useState("");
    const [copied, setCopied] = useState(false);

    // Controls the visibility of the themes selection dropdown
    const [showThemesDropdown, setShowThemesDropdown] = useState(false); 

    // Displays the genrated random spell
    const [rawOpenAI, setRawOpenAI] = useState(null);

    // Stores the random generated spell
    function handleGenerateRandomSpell() {
      setLoading(true);
      fetch("/api/generate-spell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classes: spell.classes})
      })
        .then(res => res.json())
        .then(data => {
          setRawOpenAI(data); // ← Store raw response
          const normalized = normalizeSpell(data);
          setSpell(normalized);
        })
        .catch(err => {
          alert("Failed to generate spell");
          console.error(err);
        })
        .finally(() => setLoading(false));
    }
    
    
    // Main spell data structure containing all spell properties
    const [spell, setSpell] = useState({
    name: "",
    author: "",
    level: 1,
    school: "Abjuration",
    classes: ["Wizard"],
    effects: ["None", "None", "None"],
    castingTime: "1 Action",
    range: "30 ft",
    duration: "Instantaneous",
    area: "None",
    concentration: false,
    ritual: false,
    damageSpell: false,
    verbal: true,
    somatic: false,
    material: false,
    materialText: "",
    materialType: "None",
    materialCost: 0,
    attackSave: "None",
    diceValue: "2d6",
    avgRoll: 0,
    targets: 0,
    upcastable: false,
    upcastText: "",
    hasRestriction: false,
    restrictionText: "",
    description: "",
    // Merged Metadata (for LLM use)
    version: "1.0.0",
    themes: [],
    emotionalTone: "",
     sourceType: "official"
  });


  // Loads an official spell from a JSON file
  async function handleLoadNextImportedSpell() {
    try {
      const res = await fetch("/spellQueue.json"); // Make sure to place the file in your public directory
      const queue = await res.json();
      const index = parseInt(localStorage.getItem("importIndex") || "0");
  
      if (index >= queue.length) {
        alert("🎉 You've finished importing all spells!");
        return;
      }
  
      const spell = queue[index];
      setSpell(spell);
      localStorage.setItem("importIndex", index + 1);
      alert(`Loaded spell ${index + 1} of ${queue.length}: ${spell.name}`);
    } catch (err) {
      console.error("Failed to load imported spell:", err);
      alert("Failed to load imported spell.");
    }
  }
  

  // Save current spell to localStorage
  function handleSaveSpell() {
    localStorage.setItem('savedSpell', JSON.stringify(spell));
    alert('Spell saved locally!');
  }
  
  // Loads saved spell from localStorage
  function handleLoadSavedSpell() {
    const saved = localStorage.getItem('savedSpell');
    if (saved) {
      setSpell(JSON.parse(saved));
      alert('Saved spell loaded!');
    } else {
      alert('No saved spell found.');
    }
  }
  
  // Archive the current spell
  function handleArchiveSpell() {
    const archived = JSON.parse(localStorage.getItem('archivedSpells')) || [];
    archived.push(spell);
    localStorage.setItem('archivedSpells', JSON.stringify(archived));
    alert('Spell archived!');
  }

  // Downloads the current spell as a JSON file
  function handleExportJSON() {
    const cleanSpell = {
      ...spell,
      // Force string values to a number
      avgRoll: Number(spell.avgRoll),
      targets: Number(spell.targets),
      // Normalize effects to [null, null, null] if all are "None" or empty
      effects: spell.effects.map(e => (e === "None" || e === "" ? null : e)),
  
      // Convert "None"/"" to null where appropriate
      school: spell.school === "None" ? null : spell.school,
      castingTime: spell.castingTime || null,
      range: spell.range === "None" ? null : spell.range,
      duration: spell.duration === "None" ? null : spell.duration,
      area: spell.area === "None" ? null : spell.area,
      attackSave: spell.attackSave === "None" ? null : spell.attackSave,
      materialType: !spell.material ? null : spell.materialType,
      materialText: !spell.material || spell.materialText === "" ? null : spell.materialText,
      upcastText: !spell.upcastable || spell.upcastText === "" ? null : spell.upcastText,
      restrictionText: !spell.hasRestriction || spell.restrictionText === "" ? null : spell.restrictionText,
      emotionalTone: spell.emotionalTone === "" ? null : spell.emotionalTone,
      description: spell.description === "" ? null : spell.description,
      sourceType: spell.sourceType === "" ? null : spell.sourceType,
    };
  
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanSpell, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${spell.name || "spell"}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
  
  
  // Stores list of archived spells for display
  const [archivedSpells, setArchivedSpells] = useState([]);
  // Controls the visibility of the archived spells list
  const [showArchive, setShowArchive] = useState(true);
  
  // Loads archived spells on component mount
  useEffect(() => {
    const stored = localStorage.getItem('archivedSpells');
    if (stored) {
      setArchivedSpells(JSON.parse(stored));
    }
  }, []);
  
  /// Updates archived spells list after changes
  function refreshArchive() {
    const stored = localStorage.getItem('archivedSpells');
    if (stored) {
      setArchivedSpells(JSON.parse(stored));
    }
  }
  
  // Loads a specific spell from the archive
  function handleLoadArchivedSpell(index) {
    const archived = JSON.parse(localStorage.getItem('archivedSpells')) || [];
    if (archived[index]) {
      const loaded = {
        ...archived[index],
        // Provide defaults for new fields if missing
        version: archived[index].version || "1.0.0",
        themes: Array.isArray(archived[index].themes) ? archived[index].themes : [],
        emotionalTone: archived[index].emotionalTone || "",
        sourceType: archived[index].sourceType || "official",
      };
      setSpell(loaded);
    }
  }
  
  
  /// Removes a spell from the archive
  function handleDeleteArchivedSpell(index) {
    let archived = JSON.parse(localStorage.getItem('archivedSpells')) || [];
    archived.splice(index, 1);
    localStorage.setItem('archivedSpells', JSON.stringify(archived));
    refreshArchive();
  }

  // === FORM HANDLING ===
  
  // Universal change handler for form inputs
  // Handles both regular inputs and checkboxes
  // Special handling for material checkbox to reset material type
  function handleChange(e) {
    const { name, value, type, checked } = e.target;
  
    setSpell((prev) => {
      const updatedSpell = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
  
      // Reset materialType to "None" if material is unchecked
      if (name === "material") {
        updatedSpell.materialType = checked ? "Trivial" : "None";
      }
  
      return updatedSpell;
    });
  }

  // === VALIDATION ===
  
  // Validates spell properties before saving
  // Checks for required name, valid level range, and non-negative damage
  function validateSpell() {
    const errors = [];
    if (!spell.name || !spell.name.trim()) errors.push("Spell name is required.");
    if (spell.level < 0 || spell.level > 9) errors.push("Spell level must be between 0 and 9.");
    if (spell.avgRoll < 0) errors.push("Average damage must be ≥ 0.");
    if (!spell.classes || spell.classes.length === 0) errors.push("At least one class must be selected.");
    return errors;
  }
  const validationErrors = validateSpell();

  // === POWER CALCULATIONS ===
  
  // Stores calculated spell metrics
  const [power, setPower] = useState(0);
const [deviation, setDeviation] = useState(0);
const [stability, setStability] = useState(0);
const [craftingDC, setCraftingDC] = useState(0);
const [evaluation, setEvaluation] = useState("");

  // Calculates spell power whenever spell changes
  useEffect(() => {
     // Fully normalize the spell object for consistent calculations
  const spellForCalc = {
    ...spell,
    effects: (spell.effects || []).map(e => e?.trim() || "None").slice(0, 3),
  };

  // Pad to 3 items if shorter
  while (spellForCalc.effects.length < 3) {
    spellForCalc.effects.push("None");
  }
  const normalizedRoll = normalizeNumber(spell.diceValue);
  if (spell.avgRoll !== normalizedRoll) {
    setSpell((prev) => ({
      ...prev,
      avgRoll: normalizedRoll
    }));
  }
  
    const newPower = calculatePower(spell);
    const newEvaluation = evaluatePower(spell.level, newPower);
    const newDeviation = getDeviation(spell.level, newPower);
    const newStability = getStability(spell, newPower, newDeviation);
    const newDC = getSpellCraftingDC(spell, newStability, newEvaluation);
    const newSpellCode = encodeSpellToSpellCode(spell, newStability, newPower, newDC);
  
    // console.log("🧪 FULL CALC SNAPSHOT →", {
    //  spell: spellForCalc,
    //  newPower,
    //  newEvaluation,
    //  newDeviation,
    //  newStability,
    //  newDC,
    //  newSpellCode
    // });

    setPower(newPower);
    setEvaluation(newEvaluation);
    setDeviation(newDeviation);
    setStability(newStability);
    setCraftingDC(newDC);
    setSpellCode(newSpellCode);
  }, [spell]);
  
   // === UTILITY FUNCTIONS ===
  
  // Copies spell code to clipboard with visual feedback
  function handleCopy() {
    navigator.clipboard.writeText(spellCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  }
  
   // Handles admin mode toggle with password protection
  function handleAdminLogin() {
    if (adminMode) {
      setAdminMode(false);
      return;
    }
  
    const entered = prompt("Enter Admin Password:");
    if (entered === import.meta.env.VITE_ADMIN_PASSWORD) {
      setAdminMode(true);
    } else {
      alert("Incorrect password.");
    }
  }

  // Generates a random spell using the API
  const [loading, setLoading] = useState(false);

  function handleGenerateRandomSpell() {
    setLoading(true);
    fetch("/api/generate-spell", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    })
      .then(res => res.text()) // Instead of .json()
        .then(text => {
          if (!text) {
            throw new Error("No response from server.");
          }
    
          const cleaned = text.replace(/```(?:json)?|```/gi, "").trim();
          let json;
    
          try {
            json = JSON.parse(cleaned);
          } catch (parseError) {
            console.error("Spell parse error:", parseError);
            console.warn("Raw response received:", text);
            alert("Failed to parse spell. Check server logs for details.");
            return;
          }
    
          setRawOpenAI(json);
          const normalized = normalizeSpell(json);
          setSpell(normalized);
        })
        .catch(err => {
          console.error("Fetch or OpenAI error:", err);
          alert("Failed to generate spell: " + err.message);
        })
        .finally(() => setLoading(false));
    }
  
  
  
   
// === RENDER UI ===
  return (
  <div className="p-4 mx-auto bg-white shadow rounded-lg">
    <div className="grid grid-cols-12 gap-6">
      {/* Main Content - Spell Editor (Left Side) */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <h2 className="text-2xl font-bold mb-4">Spell Designer</h2>
        
        {/* Admin Mode Toggle */}
        <div className="mb-4 flex items-center justify-between">
  <div>
    <button
      onClick={handleAdminLogin}
      className={`text-xs px-2 py-1 rounded transition-colors ${
        adminMode
          ? "bg-red-200 hover:bg-red-300 text-red-800"
          : "bg-blue-200 hover:bg-blue-300 text-blue-800"
      }`}
    >
      {adminMode ? "🚪 Exit Admin Mode" : "🔐 Enter Admin Mode"}
    </button>
  </div>

  {adminMode && (
    <div className="text-xs font-semibold text-green-600 animate-pulse">
      ✅ Admin Mode Enabled
    </div>
  )}


{/* Admin Mode: Loading Official Spell Button*/}
{adminMode && (
  <button
    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-sm"
    onClick={handleLoadNextImportedSpell}
  >
    📥 Load Next Official Spell
  </button>
)}

{/* Admin Mode: Override official spell index */}
{adminMode && (
  <div className="flex items-center gap-2 mt-2">
    <label className="text-xs text-gray-700">Set Import Index:</label>
    <input
      type="number"
      className="w-16 p-1 border rounded text-sm"
      min={0}
      onChange={(e) => {
        const val = parseInt(e.target.value);
        if (!isNaN(val)) localStorage.setItem("importIndex", val);
      }}
    />
  </div>
)}


  
</div>
      {/* Admin Mode Toggle */}
  
      {adminMode && (
  <section className="p-6 rounded-lg bg-yellow-50 border border-yellow-200 shadow-md mt-6">
    <h2 className="text-xl font-bold text-yellow-700 mb-4">🛠️ Metadata (Admin Only)</h2>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div className="block text-sm text-yellow-800">


      
  <label className="flex items-center justify-between cursor-pointer font-medium mb-1">
    Themes:
    <button
      type="button"
      onClick={() => setShowThemesDropdown(!showThemesDropdown)}
      className="text-xs text-blue-600 underline ml-2"
    >
      {showThemesDropdown ? "Hide List" : "Choose Themes"}
    </button>
  </label>

  {showThemesDropdown && (
    <div className="border border-yellow-300 rounded p-2 bg-white">
      <p className="text-xs text-gray-500 mb-1">Select multiple with Ctrl/Cmd or click individually:</p>
      <select
        multiple
        value={spell.themes}
        onChange={(e) => {
          const selected = Array.from(e.target.selectedOptions, option => option.value);
          setSpell((prev) => ({ ...prev, themes: selected }));
        }}
        style={{ height: "430px" }}
        className="w-full p-2 border rounded bg-yellow-50"
      >
        {THEME_OPTIONS.map((theme) => (
          <option key={theme} value={theme}>
            {theme}
          </option>
        ))}
      </select>
    </div>
  )}

  {/* Optional: preview of selected themes */}
  {Array.isArray(spell.themes) && spell.themes.length > 0 && (
    <div className="mt-2 flex flex-wrap gap-2">
      {spell.themes.map((theme) => (
        <span
          key={theme}
          className="bg-yellow-200 text-yellow-800 text-xs px-2 py-1 rounded-full"
        >
          {theme}
        </span>
      ))}
    </div>
  )}
</div>



      <label className="block text-sm text-yellow-800">
        Emotional Tone:
        <select
          value={spell.emotionalTone}
          onChange={(e) =>
            setSpell((prev) => ({ ...prev, emotionalTone: e.target.value }))
          }          
          className="w-full mt-1 p-2 rounded border border-yellow-300 bg-white"
        >
          <option value="">None</option>
          <option value="hopeful">Hopeful</option>
          <option value="mournful">Mournful</option>
          <option value="ominous">Ominous</option>
          <option value="triumphant">Triumphant</option>
          <option value="serene">Serene</option>
          <option value="chaotic">Chaotic</option>
          <option value="grim">Grim</option>
          <option value="calm">Calm</option>
          <option value="menacing">Menacing</option>
          <option value="mysterious">Mysterious</option>
          <option value="reverent">Reverent</option>
          <option value="joyful">Joyful</option>
          <option value="intimidating">Intimidating</option>
          <option value="playful">Playful</option>
          <option value="somber">Somber</option>
          <option value="eerie">Eerie</option>
          <option value="neutral">Neutral</option>
        </select>
      </label>

      <label className="block text-sm text-yellow-800">
        Source Type:
        <select
          value={spell.sourceType}
          onChange={(e) =>
            setSpell((prev) => ({ ...prev, sourceType: e.target.value }))
          }          
          className="w-full mt-1 p-2 rounded border border-yellow-300 bg-white"
        >
          <option value="student">Student</option>
          <option value="studentVar">StudentVarient</option>
          <option value="official">Official</option>
          <option value="officialVar">OfficialVarient</option>
          <option value="faculty">Faculty</option>
          <option value="facultyVar">FacultyVarient</option>
        </select>
      </label>
    </div>
  </section>
)}


       {/* Spell Basic Info */}
    <section className="p-6 rounded-lg bg-gray-800 shadow-md">
      <h2 className="text-xl font-bold text-white mb-4">📜 Spell Basics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-white">
          Spell Name:
          <input name="name" value={spell.name} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white" />
        </label>
        <label className="block text-white">
          Author:
          <input name="author" value={spell.author} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white" />
        </label>
        <label className="block text-white">
          Level:
          <input name="level" type="number" min="0" max="9" value={spell.level} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white" />
        </label>
        <label className="block text-white">
          School:
          <select name="school" value={spell.school} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white">
            {SPELL_SCHOOLS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* New Class Selection UI */}
      <div className="block text-white md:col-span-2">
        <label className="flex items-center justify-between cursor-pointer font-medium mb-1">
          Classes:
          <button
            type="button"
            onClick={() => setShowClassesDropdown(!showClassesDropdown)}
            className="text-xs text-blue-400 underline ml-2"
          >
            {showClassesDropdown ? "Hide List" : "Choose Classes"}
          </button>
        </label>

        {showClassesDropdown && (
          <div className="border border-gray-600 rounded p-2 bg-gray-700">
            <p className="text-xs text-gray-300 mb-1">Select at least one class (Use Shift or Control/Command):</p>
            <select
              multiple
              name="classes"
              value={spell.classes}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                if (selected.length > 0) { // Ensure at least one class is selected
                  setSpell(prev => ({ ...prev, classes: selected }));
                  // The stability/power calculations will auto-update because 
                  // we're using setSpell which triggers the useEffect
                }
              }}
              className="w-full p-2 border rounded bg-gray-600 text-white"
              style={{ height: "200px" }}
            >
              {["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"].map((cls) => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        )}

        {/* Preview of selected classes */}
        <div className="mt-2 flex flex-wrap gap-2">
          {spell.classes.map((cls) => (
            <span
              key={cls}
              className="bg-blue-900 text-blue-100 text-xs px-2 py-1 rounded-full"
            >
              {cls}
            </span>
          ))}
        </div>
      </div>
    </section>

      {/* Effects */}
      <h2 className="text-xl font-bold text-white mb-4">✨ Spell Effects</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
  {[0, 1, 2].map((i) => {
    const usedEffects = spell.effects.filter((_, idx) => idx !== i);
    const availableOptions = EFFECT_OPTIONS.filter(
      (opt) => !usedEffects.includes(opt) || spell.effects[i] === opt
    );

    return (
      <label key={i}>
        Effect {i + 1}:
        <select
          value={spell.effects[i]}
          onChange={(e) => {
            const newEffects = [...spell.effects];
            newEffects[i] = e.target.value;
            setSpell({ ...spell, effects: newEffects });
          }}
          className="w-full p-1 border rounded"
        >
          <option value="">None</option>
          {availableOptions.map((effect) => (
            <option key={effect} value={effect}>
              {effect}
            </option>
          ))}
        </select>
      </label>
    );
  })}



</div>

      {/* Spell Traits */}
    <section className="p-6 rounded-lg bg-gray-800 shadow-md">
      <h2 className="text-xl font-bold text-white mb-4">✨ Spell Traits</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="block text-white">
          Casting Time:
          <select name="castingTime" value={spell.castingTime} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white">
            {CASTING_TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-white">
          Range:
          <select name="range" value={spell.range} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white">
            {RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block text-white">
          Duration:
          <select name="duration" value={spell.duration} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white">
            {DURATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        <label className="block text-white">
          Area:
          <select name="area" value={spell.area} onChange={handleChange} className="w-full mt-1 p-2 rounded bg-gray-700 text-white">
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
    </section>

      {/* Checkboxes */}
      <div className="flex flex-wrap gap-4 mb-4">
        {["concentration", "ritual", "damageSpell", "verbal", "somatic", "material", "upcastable", "hasRestriction"].map((key) => (
          <label key={key} className="flex items-center gap-2 capitalize">
            <input type="checkbox" name={key} checked={spell[key]} onChange={handleChange} />
            {key.replace(/([A-Z])/g, " $1")}
          </label>
        ))}
      </div>

{/* Material, Upcasting, and Restriction Fields */}
{(spell.material || spell.upcastable || spell.hasRestriction) && (
  <section className="mb-6 space-y-6">
    {/* Material Inputs */}
    {spell.material && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="block font-medium text-sm mb-1">Material Type:</span>
          <select
            name="materialType"
            value={spell.materialType}
            onChange={handleChange}
            className="w-full p-2 border rounded"
          >
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className="block">
  <span className="block font-medium text-sm mb-1">Material Description:</span>
  <textarea
    name="materialText"
    value={spell.materialText}
    onChange={handleChange}
    onInput={(e) => {
      e.target.style.height = "auto";
      e.target.style.height = `${e.target.scrollHeight}px`;
    }}
    className="w-full min-h-[40px] max-h-[300px] p-2 border rounded resize-none overflow-hidden min-h-[40px]"
    placeholder="e.g., a pinch of sulfur"
    style={{
      height: "auto",         // Initial auto height
      width: "300px",          // Full container width
      boxSizing: "border-box" // Prevent overflow issues
    }}
  />
</label>


        <label className="block sm:col-span-2">
          <span className="block font-medium text-sm mb-1">Material Cost (gp):</span>
          <input
            name="materialCost"
            type="number"
            value={spell.materialCost}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            min={0}
          />
        </label>
      </div>
    )}

    {/* Upcast & Restriction - Always stacked vertically */}
    {spell.upcastable && (
      <div>
        <label className="block font-medium text-sm mb-1">Upcast Effect:</label>
        <textarea
          name="upcastText"
          value={spell.upcastText}
          onChange={handleChange}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          placeholder="Describe what happens when cast at higher levels..."
          style={{
            height: "auto",         // Initial auto height
            width: "300px",          // Full container width
            boxSizing: "border-box" // Prevent overflow issues
          }}
          className="w-full p-2 border rounded resize-none overflow-hidden min-h-[48px]"
        />
      </div>
    )}

    {spell.hasRestriction && (
      <div>
        <label className="block font-medium text-sm mb-1">Casting Restriction:</label>
        <textarea
          name="restrictionText"
          value={spell.restrictionText}
          onChange={handleChange}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          placeholder="Describe any limitations or casting conditions..."
          style={{
            height: "auto",         // Initial auto height
            width: "300px",          // Full container width
            boxSizing: "border-box" // Prevent overflow issues
          }}
          className="w-full p-2 border rounded resize-none overflow-hidden min-h-[48px]"
        />
      </div>
    )}
  </section>
)}




      {/* Combat Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        <label>
          Attack/Save Type:
          <select name="attackSave" value={spell.attackSave} onChange={handleChange} className="w-full p-1 border rounded">
            {ATTACK_SAVE_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <label className="block text-white">
        Dice Rolled:
        <input
           name="diceValue"
           value={spell.diceValue}
           onChange={handleChange}
           className="w-full mt-1 p-2 rounded bg-gray-700 text-white"
           placeholder="e.g. 3d6"
          />

        </label>
        <label>
          # of Targets:
          <input name="targets" type="number" value={spell.targets} onChange={handleChange} className="w-full p-1 border rounded" />
        </label>
      </div>

          {/* Description */}
    <section className="p-6 rounded-lg bg-gray-800 shadow-md">
      <h2 className="text-xl font-bold text-white mb-4">📝 Description</h2>
      <textarea
        name="description"
        value={spell.description}
        onChange={handleChange}
        onInput={(e) => {
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        className="w-full p-2 rounded bg-gray-700 text-white resize-none"
        placeholder="Enter a description for your spell..."
        style={{minWidth: "700px",minHeight: "80px" , overflow: "hidden", resize: "none" }}
      />
    </section>

       {/* Validation */}
      {validationErrors.length > 0 && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Fix the following:</strong>
          <ul className="list-disc ml-5">
            {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      )}

        {/* Save, Load, Archive Buttons */}
          {/* Spell Management */}
      <section className="p-6 rounded-lg bg-gray-800 shadow-md">
        <h2 className="text-xl font-bold text-white mb-4">💾 Spell Management</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleSaveSpell}
            className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm"
          >
            Save Spell
          </button>
          <button
            onClick={handleLoadSavedSpell}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm"
          >
            Load Saved Spell
          </button>
          <button
            onClick={() => { handleArchiveSpell(); refreshArchive(); }}
            className="px-3 py-1 bg-purple-500 hover:bg-purple-600 text-white rounded text-sm"
          >
            Archive Spell
          </button>

          {adminMode && (
             <button
                onClick={handleExportJSON}
                className="px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm"
              >
               📤 Export JSON
              </button>
          )}
        </div>

        <button
  onClick={() => setShowArchive(!showArchive)}
  className="px-2 py-1 mb-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded"
>
  {showArchive ? "📕 Hide Archived Spells" : "📖 Show Archived Spells"}
</button>
{/* Show/Hide Archived Spells */}

        {/* Archived Spells List */}
        {showArchive && (
  <div className="mt-6">
    <h3 className="font-bold text-white mb-2">📚 Archived Spells</h3>
    {archivedSpells.length === 0 ? (
      <p className="text-gray-400 text-sm">No archived spells yet.</p>
    ) : (
      <div className="space-y-2">
        {archivedSpells.map((arch, idx) => (
          <div key={idx} className="p-2 border rounded bg-gray-700 text-white flex justify-between items-center">
            <div>
              <div className="font-bold">{arch.name || "(Unnamed Spell)"}</div>
              <div className="text-xs text-gray-300">{arch.school} - Level {arch.level}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleLoadArchivedSpell(idx)}
                className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded"
              >
                Load
              </button>
              <button
                onClick={() => handleDeleteArchivedSpell(idx)}
                className="px-2 py-1 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
        )}
</section>


    

      {/* Debug Output */}
      <div className="bg-gray-100 p-4 rounded border mt-4">
  <h3 className="font-semibold">Spell Data (Debug Preview)</h3>
  <pre className="text-sm whitespace-pre-wrap break-words">{JSON.stringify(spell, null, 2)}</pre>

  {rawOpenAI && (
    <>
      <h4 className="font-semibold mt-4">Raw OpenAI Response</h4>
      <pre className="text-sm whitespace-pre-wrap break-words text-gray-600">
        {JSON.stringify(rawOpenAI, null, 2)}
      </pre>
    </>
  )}
</div>

    </div>

      {/* Metrics Sidebar (Right Side) - New Fixed Position */}
      <div className="col-span-12 lg:col-span-4">
        <div className="sticky top-4 space-y-4">
          {/* Power Metrics */}
          <section className="p-4 bg-slate-100 border border-slate-300 rounded">
            <h3 className="text-lg font-bold text-slate-800">📈 Spell Metrics</h3>
            <div className="mt-4 p-3 bg-indigo-100 border border-indigo-300 rounded">
              <h3 className="text-lg font-bold text-indigo-900">🧪 Calculated Power</h3>
              <p className="text-xl font-mono">{isNaN(power) ? power : `${power} ⚡`}</p>
              <div className="mt-2">
                <span className={`inline-block font-bold text-sm px-2 py-1 rounded ${
                  evaluationColors[evaluation] || "bg-gray-200 text-gray-800"
                }`}>
                  {evaluation}
                </span>
              </div>
              <p><strong>Deviation:</strong> {formatDeviationAsPercent(deviation)}</p>
              <p><strong>Stability:</strong> {formatStabilityAsPercent(stability)}</p>
              <p><strong>Crafting DC:</strong> {craftingDC}</p>
            </div>

            {/* Power Chart */}
            {!isNaN(power) && (
              <div className="mt-4">
                <h3 className="text-lg font-bold text-gray-800 mb-2">📊 Level vs Power</h3>
                <PowerChart spellLevel={spell.level} spellPower={power} />
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  </div>
);
}
export default SpellDesigner;
