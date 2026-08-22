# Spell Crafter Polished

A cleaned-up, self-hostable Spell Crafter app for designing D&D-style homebrew spells, calculating power/stability/crafting DC, generating SpellCodes, and maintaining a local browser archive.

## What changed from the original prototype

- Rebuilt the UI into a two-column workbench with a sticky live metrics panel.
- Removed fixed-width layout traps so it works on desktops, laptops, tablets, and phones.
- Replaced Chart.js with a dependency-light SVG chart.
- Split the large single component into utilities, components, storage helpers, and server code.
- Preserved full Spell Crafter functionality: power math, stability, crafting DC, effects, classes, SpellCode encode/decode, JSON import/export, archive, admin metadata, official queue loading, and random spell generation.
- Fixed SpellCode class metadata handling and corrected several map mismatches such as Radiant/Radient and duplicate effect codes.
- Added Docker and local dev support.

## Project layout

```text
spell-crafter-polished/
  src/
    components/
      SpellCrafter.jsx
      PowerChart.jsx
    utils/
      calculatePower.js
      constants.js
      decodeSpellCode.js
      normalizeSpell.js
      powerBands.js
      spellCodeEngine.js
      spellCodeMaps.js
      spellMath.js
      spellStorage.js
    App.jsx
    main.jsx
    styles.css
  server/
    dev.js
    generateSpell.js
    index.js
  public/
    spellQueue.json
  Dockerfile
  docker-compose.yml
  package.json
```

## Local development

```bash
cd spell-crafter-polished
cp .env.example .env
npm install
npm run smoke
npm run dev
```

Then open:

```text
http://localhost:5173
```

The dev server runs Express and Vite together, so `/api/generate-spell` works locally without a separate proxy.

## Production build without Docker

```bash
npm install
npm run build
npm start
```

Then open:

```text
http://localhost:4173
```

## Docker on a server computer

```bash
cd spell-crafter-polished
cp .env.example .env
docker compose up -d --build
```

Then open from your LAN:

```text
http://SERVER_IP:4173
```

For example, on VaultCenter or VaultStar, replace `SERVER_IP` with that machine's static IP.

## Admin mode

Admin mode uses `VITE_ADMIN_PASSWORD` from `.env` at build/dev time. The default in `.env.example` is `changeme`, so change it before hosting anywhere outside your own LAN.

Admin mode unlocks:

- metadata editing
- source type
- emotional tone
- themes
- loading the next spell from `public/spellQueue.json`

## Archive behavior

Saved spells are stored in the browser's `localStorage`. This keeps the app simple and server-light for LAN hosting. Export important spells as JSON when you want a portable backup.

## Random spell generation

The bundled `/api/generate-spell` endpoint can use a custom local Ollama model, optional OpenAI fallback, or the guaranteed offline procedural generator. By default, `SPELLCRAFTER_GENERATOR_PROVIDER=auto` tries:

1. Ollama model from `OLLAMA_MODEL`
2. OpenAI if `ENABLE_OPENAI_FALLBACK=true` and an API key is configured
3. local procedural generation

The frontend contract remains:

```json
{
  "source": "local-generator",
  "spell": { "name": "..." }
}
```

For the full local fine-tuning and Ollama integration workflow, see [docs/custom-llm-training.md](docs/custom-llm-training.md).

## Notes for future upgrades

- Add a database or file-backed archive if you want shared spells across multiple devices.
- Add login/auth before exposing this outside your VPN.
- Expand the custom local model training corpus and periodically revalidate generated samples.
- Add automated UI tests once the design settles.
