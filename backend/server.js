// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// ✅ Initialize OpenAI with new v4 SDK syntax
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post('/api/generate-spell', async (req, res) => {
  const { classes = ["Wizard"] } = req.body;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            "You are a spell inventor tasked with inventing original but balanced D&D 5e-style spells. Your output must be a single valid JSON object and nothing else — no code block wrappers, no text outside the object. Use exactly 1 to 3 items from this list as the value for the 'effects' field (array of strings): [Combat, Control, Utility, Creation, Buff, Communication, Healing, Foreknowledge, Detection, Charmed, Debuff, Frightened, Blinded, Prone, Social, Shapechanging, Deception, Restrained, Movement, Exploration, Summoning, Warding, Unconscious, Dunamancy, Invisible, Teleportation, Deafened, Additional, Negation, Banishment, Environment, Stunned, Petrified, Paralyzed, Poison, Thunder, Psychic, Radiant, Bludgeoning, Fire, Force, Acid, Necrotic, Cold, Lightning, Piercing, Slashing]. Do not invent new effect names. Use only these fields in your response: name, author, level, school, effects, castingTime, range, duration, area, verbal, somatic, material, materialText, materialCost, attackSave, avgRoll, targets, upcastable, upcastText, hasRestriction, restrictionText, description, classes (based on spell flavor from the following list: Artificer, Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, and/or Wizard)."


        },
        { role: 'user', content: 'Create a new spell.' }
      ],
      temperature: 1.0
    });

    const rawText = completion.choices?.[0]?.message?.content;
    console.log("Raw OpenAI response:", rawText);

    if (!rawText) {
      console.warn("⚠️ OpenAI returned no text.");
      return res.status(500).json({ error: "OpenAI returned no content" });
    }

    const cleaned = rawText.replace(/```(?:json)?|```/gi, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("❌ Failed to parse OpenAI response:", parseError);
      return res.status(500).json({ error: "Failed to parse OpenAI response", raw: rawText });
    }

    res.json(parsed);
      
    } catch (error) {
      console.error("🔥 OpenAI API Error:", error);
      res.status(500).json({
        error: "OpenAI request failed",
        details: error.message || "Unknown error",
        stack: error.stack
      });
    }
  });
  
  app.listen(port, () => {
    console.log(`✅ Server running on port ${port}`);
  });
  
