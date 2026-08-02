/**
 * Summoning.
 *
 * A player describes something; the model fills in the blueprint object literal
 * and this route hands it back. The zod schema in `blueprint.ts` is converted
 * straight into the tool's `input_schema`, so the contract the model is held to
 * and the contract the simulation reads are the same object — there is no
 * translation layer to drift.
 *
 * Three modes:
 *   creature — one fully specified creature
 *   terrain  — the land itself, drawn as a coarse character map
 *   scene    — a land *and* the creatures that live in it, designed together
 *
 * This calls the Messages API directly rather than going through the AI SDK's
 * `generateObject`, which hard-codes `temperature: 0` (ai@4 —
 * `temperature != null ? temperature : 0`, no way to omit it). Claude Opus 5
 * removed the sampling parameters and rejects the request outright, so the SDK
 * path can only reach this model by downgrading it.
 *
 * We do borrow the SDK's `zodSchema` for the conversion, though — it delegates
 * to the same `zod-to-json-schema` the lockfile already pins at a version this
 * app's zod satisfies, which a direct dependency on that package does not.
 *
 * If anything goes wrong — no key, model error, refusal, malformed art — this
 * falls back to a procedural creature instead of an error. A kid asking for a
 * purple fire snail should always get a purple fire snail.
 */
import { zodSchema } from 'ai'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { BlueprintSchema, SceneSchema } from '@/app/micro-land/domain/blueprint'
import { BASE_MATERIAL_IDS, MATERIALS } from '@/app/micro-land/domain/config/materials'
import {
  proceduralCreature,
  proceduralScene,
} from '@/app/micro-land/domain/procedural'
import { TerrainSchema } from '@/app/micro-land/domain/terrain'

const MODEL = 'claude-opus-5'
const API_URL = 'https://api.anthropic.com/v1/messages'
const MAX_PROMPT = 300

/** A scene is several blueprints in one response, so it needs more room. */
const MAX_TOKENS = { creature: 16000, scene: 32000, terrain: 16000 }

type Mode = 'creature' | 'scene' | 'terrain'

/** Scenes can take a while — give the platform room before it cuts us off. */
export const maxDuration = 120

/**
 * The list of fertile materials is derived, not typed out.
 *
 * The model is told where plants can root, and getting that wrong produces a
 * beautiful world that quietly starves. Reading it off the material table means
 * adding a fertile material updates the prompt for free.
 */
const FERTILE = BASE_MATERIAL_IDS.filter((id) => MATERIALS[id].fertile).join(', ')

const SYSTEM = `You design creatures for Micro Land, a 2D pixel-art physics sandbox played by children and families.

You are given a short description and you fill in a complete creature blueprint. The blueprint is pure data — pixels, animation, physics, appetite — and the running world reads it directly, so every field matters.

HOW THE WORLD WORKS
- The world is a grid of tiles: ${BASE_MATERIAL_IDS.join(', ')}. Solid tiles block movement, water and lava flow, lava kills anything not immune to it.
- Some tiles have their own habits: acid burns like lava and eats through soft rock, sap is thick and holds things fast without drowning them, cloud is soft enough to sink slowly through, snow and ice melt near heat.
- Gravity pulls things down. Walkers need ground; fliers do not; swimmers only move inside water and suffocate on land; rooted things never move at all.
- The food chain is one rule: a creature can eat another if it lists one of the target's tags in "eats", AND the target is not larger than it. That single rule produces the whole ecosystem, so choose "size", "tags" and "eats" deliberately.
- Creatures get hungry, hunt, flee from anything that hunts them, breed when well fed, and die of hunger, drowning, lava or old age. Populations rise and crash on their own.

READING THE DESCRIPTION
- Describe what the creature IS, not what it eats. "A snail that eats moss" is a snail — a crawling animal whose "eats" list is ["plant"]. It is not a plant.
- Only use the rooted plant type for something that genuinely is a plant, fungus, coral or seed.

DRAWING
- Pixel art only, from 3x3 up to 28 wide and 24 tall.
- DRAW IT AT THE SCALE ITS SIZE SAYS. This is the single most common mistake: a dragon drawn 9 pixels wide is a bug that happens to eat everything. Match the size number:
    size 1 (mite, seed)      3-5 wide
    size 2 (bug, fish)       5-8 wide
    size 3 (cat)             7-11 wide
    size 4 (wolf, big bird)  11-16 wide
    size 5 (bear, horse)     15-22 wide
    size 6 (dragon, whale)   20-28 wide
- Big creatures are worth the pixels. If something is described as huge, ancient, giant, monstrous or a dragon, it should be size 6 and drawn near the full 28 — that is the difference between a monster and a beetle. Use the height too: a long wyrm can be wide and short, a tyrannosaur tall and narrow.
- Use the extra room on a big creature for structure, not noise: a readable head, a distinct limb, a tail that tapers. Detail that doesn't change the silhouette is wasted at this scale.
- THE HEAD IS THE HARDEST PART AND THE PART THAT DECIDES WHETHER IT WORKS. A head drawn in the body's own colour is a blob on a neck, and that is the single most common way a big creature fails. On anything size 4 or larger, give the head all four of these:
    · a dark outline running along the jaw and over the skull, so the head separates from both the neck and the sky behind it
    · an eye of one or two pixels in a colour used NOWHERE else on the creature, with a dark pixel touching it for contrast
    · a jaw line — a row of dark or transparent pixels cutting between the upper and lower jaw. An open mouth with a gap inside it reads far better than a closed one
    · a snout or muzzle that breaks the outline and pokes forward past the neck, rather than a bump on the shoulders
- Spend your contrast on the head. The rest of a creature can be nearly flat and it will still read, as long as the head is crisp — a viewer finds the face first and decides there.
- Use a body color, a darker shade for legs and underside, and usually one bright pixel for an eye. Small creatures need 3-4 colors; a size 5 or 6 can carry 6-10.
- Draw the creature FACING RIGHT.
- Always give two frames, and make the second a SMALL change from the first — a leg swapping position, a wing beating, a blink. Two unrelated drawings read as a glitch, not an animation.
- A very large creature collides with its middle rather than its whole outline, so wings, tails and long necks can hang over the edges. Draw the shape you want; you do not have to keep it compact.

DRAWING THE LAND
- The world is a grid 672 tiles wide and 132 tall — a long, wide stretch of land that the player scrolls across. You draw it as a map about 120 characters across and 24 rows down, which is scaled up and roughened, so draw big shapes and let the detail happen.
- Because it is wide, give it a JOURNEY: different country at each end and something to find in between. A shoreline that becomes cliffs that become a cave system beats the same hill drawn 120 times.
- The top row is the top of the sky; the bottom row is the very bottom of the world. "." is empty air.
- KEEP THE GROUND LOW. The surface — the first row that is mostly solid — should sit about 30-50% of the way up from the bottom, so at least half the map is open air. A horizon two-thirds up the page looks right on paper and plays badly: everything worth watching happens above the ground, and a world that is mostly dirt leaves the creatures nowhere to live. On a 24-row map that means roughly 13-16 rows of sky before the land starts.
- Depth below the surface is only interesting where it is hollow. A solid slab of stone ten rows thick is wasted world — put caves, pockets, water or a lava seam in it, or make it thinner.
- Plants can only root on ${FERTILE}. A world built only from stone, metal and glass looks fine and then quietly starves, because nothing can grow and so nothing can eat. Always put some fertile ground where you want life.
- Match the land to the creatures: water deep enough to swim in if anything swims, open air if anything flies, and somewhere safe to stand if anything walks.

TONE
- All ages. Nothing gory, frightening, or cruel. Creatures can hunt each other — that is nature — but keep names and descriptions warm and curious.
- Interpret imaginative requests generously and literally. "A cat made of lava" should be lava-colored, cat-shaped, and immune to lava.`

function creaturePrompt(description: string): string {
  return `Design one creature: "${description}"

Fill in every field. Make its numbers match its description — a heavy creature should have high mass and low speed, a fragile one should have a short lifespan.`
}

function terrainPrompt(description: string): string {
  return `Draw the land for: "${description}"

Make somewhere worth exploring — height, depth, and at least one surprise (a cave, an overhang, a pool, a lava seam). Remember the fertile ground.`
}

function scenePrompt(description: string): string {
  return `Design a small scene: "${description}"

First build the land it happens in, then the creatures that live there.

Give 2-4 creatures and how many of each to place. They must form a food chain that can actually run on its own:
- Include at least one rooted plant creature with "eats": [] — nothing else has anything to eat without it.
- Include at least one creature that eats "plant".
- Usually include one larger creature that eats "meat".
- Place more of the small things than the big things. A world with eight predators and two plants dies in seconds.`
}

interface ToolUseBlock {
  type: string
  name?: string
  input?: unknown
}

/**
 * Ask Claude to fill in `schema` and return the tool input verbatim.
 * Sanitizing happens on the client, against the same schema's rules.
 */
async function askClaude(
  apiKey: string,
  schema: z.ZodTypeAny,
  toolName: string,
  userPrompt: string,
  maxTokens: number,
  signal: AbortSignal
): Promise<unknown> {
  // Refs come out inlined, which is what a tool input_schema wants.
  const { $schema, ...inputSchema } = zodSchema(schema).jsonSchema as Record<
    string,
    unknown
  >
  void $schema // Anthropic rejects the $schema meta-key on a tool input schema.

  const response = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM,
      tools: [
        {
          name: toolName,
          description: 'Return the finished blueprint.',
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`anthropic ${response.status}: ${detail.slice(0, 300)}`)
  }

  const data = (await response.json()) as {
    stop_reason?: string
    content?: ToolUseBlock[]
  }

  // Safety classifiers can decline; treat it as a failed summon, not a crash.
  if (data.stop_reason === 'refusal') {
    throw new Error('refused')
  }

  const tool = data.content?.find((b) => b.type === 'tool_use' && b.name === toolName)
  if (!tool?.input) throw new Error('no tool_use block in response')
  return tool.input
}

interface SummonRequest {
  mode?: unknown
  prompt?: unknown
}

export async function POST(request: NextRequest) {
  let body: SummonRequest
  try {
    body = (await request.json()) as SummonRequest
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const mode: Mode =
    body.mode === 'scene' ? 'scene' : body.mode === 'terrain' ? 'terrain' : 'creature'
  const description =
    typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT) : ''

  if (description.length < 2) {
    return NextResponse.json({ error: 'Tell me what to generate first.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json(fallback(mode, description))

  // Give up before the platform does, so we can still return a creature.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 105_000)

  try {
    if (mode === 'terrain') {
      const terrain = await askClaude(
        apiKey,
        TerrainSchema,
        'design_terrain',
        terrainPrompt(description),
        MAX_TOKENS.terrain,
        controller.signal
      )
      return NextResponse.json({ mode: 'terrain', source: 'model', terrain })
    }

    if (mode === 'scene') {
      const scene = (await askClaude(
        apiKey,
        SceneSchema,
        'design_scene',
        scenePrompt(description),
        MAX_TOKENS.scene,
        controller.signal
      )) as {
        title?: string
        note?: string
        creatures?: unknown[]
        terrain?: unknown
      }

      if (!Array.isArray(scene.creatures) || scene.creatures.length === 0) {
        throw new Error('scene had no creatures')
      }

      return NextResponse.json({
        mode: 'scene',
        source: 'model',
        title: scene.title ?? 'A Small World',
        note: scene.note ?? '',
        terrain: scene.terrain ?? null,
        creatures: scene.creatures,
      })
    }

    const blueprint = await askClaude(
      apiKey,
      BlueprintSchema,
      'design_creature',
      creaturePrompt(description),
      MAX_TOKENS.creature,
      controller.signal
    )
    return NextResponse.json({ mode: 'creature', source: 'model', blueprint })
  } catch (error) {
    // A failed summon should still produce a creature — falling back is a much
    // better experience than an error toast, especially for this audience.
    console.error('micro-land summon failed:', error)
    return NextResponse.json(fallback(mode, description))
  } finally {
    clearTimeout(timeout)
  }
}

function fallback(mode: Mode, description: string) {
  if (mode === 'terrain') {
    // No model: sanitizeTerrain's own fallback map is a perfectly good island.
    return { mode: 'terrain' as const, source: 'offline' as const, terrain: null }
  }
  if (mode === 'scene') {
    return { mode: 'scene' as const, source: 'offline' as const, ...proceduralScene(description) }
  }
  return {
    mode: 'creature' as const,
    source: 'offline' as const,
    blueprint: proceduralCreature(description),
  }
}
