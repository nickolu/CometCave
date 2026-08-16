/**
 * Micro Land — core types.
 *
 * The whole point of this world is that a creature is *data*. Everything a
 * creature is — its pixels, its animation, how it falls, what it eats, what it
 * runs from, what it leaves behind when it dies — lives in a single plain
 * object literal. Nothing about a creature is code. That's what lets an LLM
 * invent one at runtime (see `blueprint.ts` + the summon route) and drop it
 * into a running world with no new rendering or behavior code.
 */

/**
 * Tile materials. The world is a grid of these.
 *
 * `BaseMaterialId` is the vocabulary — the list a person (or the summoning
 * model) thinks in. A handful of those are *tintable*: the player can paint them
 * in any of `TintId`'s colors, and each color is its own entry in the tile grid
 * (`'plastic-red'`, `'crystal-blue'`). Tints are pure recolors — they inherit
 * every physical property from the material they came from.
 */
export type BaseMaterialId =
  | 'air'
  | 'dirt'
  | 'grass'
  | 'stone'
  | 'sand'
  | 'water'
  | 'lava'
  | 'ice'
  | 'metal'
  | 'glass'
  | 'ash'
  | 'obsidian'
  | 'wood'
  | 'snow'
  | 'mud'
  | 'quicksand'
  | 'moss'
  | 'crystal'
  | 'gem'
  | 'gold'
  | 'bone'
  | 'iron'
  | 'marble'
  | 'plastic'
  | 'cloud'
  | 'sap'
  | 'acid'
  | 'shed-skin'
  | 'web'
  | 'termite-mound'

/** The colors a tintable material can be painted in. */
export type TintId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'white'
  | 'black'

/** Materials that come in colors. */
export type TintableMaterialId = 'plastic' | 'crystal' | 'gem' | 'cloud'

export type MaterialId = BaseMaterialId | `${TintableMaterialId}-${TintId}`

export interface Material {
  id: MaterialId
  name: string
  /** Base color, #rrggbb. Per-tile jitter is applied at render time. */
  color: string
  /** How much the renderer varies each tile's color, 0..1. Gives texture. */
  grain: number
  /** Solid tiles block movement and stop falling powders. */
  solid: boolean
  /** Liquids flow sideways and creatures can swim/drown in them. */
  liquid: boolean
  /** Powders fall and pile into slopes. */
  powder: boolean
  /** Touching this kills anything not immune to it. */
  deadly: boolean
  /** Emits light into the dark. 0 = none. */
  glow: number
  /** Plants can only root on these. */
  fertile: boolean
  /**
   * How much this gums up anything moving through it, 0..1.
   *
   * Only means anything for stuff you can be *inside* — cloud and sap. 0 is
   * open air; 0.9 is wading through treacle.
   */
  viscous: number
  /** A liquid you can still breathe in, so it never drowns anything. */
  breathable: boolean
  /** Turns to water next to lava. */
  melts: boolean
  /** Eats through neighbouring solids, using itself up as it goes. */
  corrosive: boolean
  /** Corrosive materials can't touch this. */
  acidProof: boolean
  /** The player can paint this in any tint. Set on the base material only. */
  tintable: boolean
  /** For a tint variant, the material it is a recolor of. */
  tintOf: TintableMaterialId | null
}

// ---------------------------------------------------------------------------
// Creature blueprints — the promptable entity model
// ---------------------------------------------------------------------------

/**
 * Pixel art for a creature.
 *
 * `frames` is an array of animation frames; each frame is an array of row
 * strings; each character in a row is a key into `palette`. `.` is always
 * transparent. Every row in every frame must be the same length.
 *
 *   palette: { b: '#33dd88', e: '#ffffff' }
 *   frames: [
 *     ['.bbb.',
 *      'bebeb',
 *      '.bbb.'],
 *   ]
 */
export interface CreatureArt {
  /** Single-character key → `#rrggbb`. `.` is reserved for transparent. */
  palette: Record<string, string>
  /** 1–4 frames of equal dimensions. */
  frames: string[][]
  /** Milliseconds per animation frame. */
  frameMs: number
  /** Mirror the sprite horizontally when moving left. */
  faceMotion: boolean
}

export type LocomotionKind =
  /** Affected by gravity, walks on solid ground, can jump. */
  | 'walk'
  /** Ignores gravity, moves freely through air. */
  | 'fly'
  /** Only moves inside liquid; flops helplessly on land. */
  | 'swim'
  /** Sticks to any surface — walls and ceilings included. */
  | 'crawl'
  /** Gravity applies but weakly; bobs and drifts. */
  | 'drift'
  /** Never moves. Plants, eggs, coral, mushrooms. */
  | 'root'

export interface CreatureBody {
  /** Gravity multiplier. 0 = weightless, 1 = normal, 3 = boulder. */
  mass: number
  /** How much velocity is kept on impact, 0..1. */
  bounce: number
  /** Velocity retained per second in air, 0..1. Low = sluggish. */
  drag: number
  /** > 1 floats up in liquid, < 1 sinks. */
  buoyancy: number
  /** Materials that can't hurt this creature (e.g. `['lava']`). */
  immuneTo: MaterialId[]
}

export interface CreatureMove {
  kind: LocomotionKind
  /** Tiles per second at full tilt. */
  speed: number
  /** Jump impulse in tiles/second. Only used by `walk`. */
  jump: number
  /**
   * How much of its travelling is done in the air, 0..1. Only used by `walk`.
   *
   * At 0 it runs, and only leaves the ground when something is in its way or
   * it is trying to escape. Above 0 it *hops*: the whole of its speed goes into
   * the leap rather than into its legs, so it covers roughly the ground a
   * walker does but in bursts, with a beat on landing. 0.3 is a frog that sits
   * between jumps; 1 is a grasshopper that is barely ever down.
   */
  hop: number
  /** Chance per second of picking a new idle direction, 0..1. */
  restlessness: number
}

export interface CreatureDiet {
  /**
   * Tags this creature can eat. A creature can eat another if any of these
   * tags appears in the target's `tags` *and* the target isn't bigger than it.
   * This one rule is the entire food chain.
   */
  eats: string[]
  /** Extra tags to flee from beyond its natural predators. */
  fears: string[]
  /** Hunger gained per second, 0..1 scale. At 1 it starts starving. */
  hungerRate: number
  /** How long it survives at full hunger before dying. */
  starveSeconds: number
  /** Fullness (0..1) needed before it will reproduce. */
  breedAt: number
  /** Dies of old age after this long. */
  lifespanSeconds: number
}

export interface CreatureSenses {
  /** How far it can spot food or danger, in tiles. */
  sight: number
  /**
   * Chemical detection range in tiles. Creatures with chemoreception > 0
   * sample scent concentration gradients across adjacent tiles and move toward
   * higher concentrations. Can track prey scents (any species tagged as food),
   * not just same-species beacons.
   */
  chemoreception?: number
}

export interface CreatureHabitat {
  /** If set, it takes damage anywhere that isn't one of these materials. */
  needs: MaterialId[] | null
  /** Non-swimmers drown; set false for amphibians. */
  drowns: boolean
}

/**
 * A creature that changes the world around it rather than just living in it.
 *
 * This is how a bee is different from a moth. Both fly and eat plants; only one
 * of them makes the meadow grow faster. Kept as data like everything else, so a
 * summoned creature can be a helper too.
 */
export interface CreatureAura {
  /** How far the effect reaches, in tiles. */
  radius: number
  /** Creatures carrying any of these tags breed faster nearby. */
  helps: string[]
  /** How much faster. 1 = no help, 3 = three times as fast. */
  boost: number
  /** Ground it slowly changes as it goes, e.g. stone into dirt. */
  converts: { from: MaterialId; to: MaterialId } | null
  /** Conversions per second, at most. Low reads as patient work. */
  convertRate: number
}

export interface CreatureDeath {
  /** Leaves this material behind on the tile where it died. */
  becomes: MaterialId | null
  /** Color of the burst of particles it leaves, `#rrggbb`. */
  particleColor: string
  /** How many particles. 0 for a quiet death. */
  particleCount: number
}

/**
 * A complete creature, as a plain object literal.
 *
 * Everything here is data an LLM can author. Nothing is a function, a class,
 * or a reference to code. Add one of these to the world and it lives.
 */
export interface CreatureBlueprint {
  id: string
  name: string
  /** One-line description, shown in the palette and the field guide. */
  blurb: string
  /**
   * Relative size, 1 (mite) to 6 (leviathan). Drives the food chain: nothing
   * can eat something bigger than itself.
   */
  size: number
  /** What this creature *is*. Others hunt it by matching these. */
  tags: string[]
  art: CreatureArt
  body: CreatureBody
  move: CreatureMove
  diet: CreatureDiet
  senses: CreatureSenses
  habitat: CreatureHabitat
  death: CreatureDeath
  /** What it does to its surroundings, or null for the vast majority. */
  aura: CreatureAura | null
  /** Light it casts into dark areas, 0..1. */
  glow: number
  /**
   * How harmful this creature is to eat, 0..1.
   *
   * Typically nonzero only for plants. When an animal consumes a toxic plant it
   * keeps the meal but moves at half-speed for `toxicity * 5` seconds — a
   * deterrent rather than a kill, creating selection pressure for resistance.
   */
  toxicity?: number
  /** True for anything the player summoned, so we can badge it in the UI. */
  summoned?: boolean
  /**
   * Whether this species lays eggs rather than giving live birth.
   *
   * When true, breeding drops an Egg at the breeding spot with inherited
   * traits; the juvenile hatches after `TUNING.eggHatchSeconds`. Eggs are
   * vulnerable to predation in the meantime.
   */
  egglayer?: boolean
  /**
   * Optional symbiosis partner.
   *
   * When set to another species' blueprintId, this creature treats that species
   * as a mutualistic partner: it won't attack them even if its diet says it
   * could, and when near them it gets a 15% speed boost and 20% slower hunger
   * drain. The bond is declared here rather than negotiated at runtime, so it
   * is stable but one-sided by default — both partners have to name each other
   * for the buff to apply to both.
   */
  symbiosisPartnerId?: string | null
  /**
   * Optional trait overrides applied when each instance of this species is first
   * spawned. The builder uses this to propagate the roam slider into the world
   * without widening the spawning path.
   */
  traitDefaults?: Partial<Traits>
  /**
   * When true, this species is parasitic: instead of killing prey on contact,
   * it attaches and drains the host's energy over time without immediately
   * killing it. The host's `diet.eats` categories still determine valid hosts.
   */
  parasite?: boolean
  /**
   * When true, this species slowly converts dirt tiles to mud as it moves
   * through them — the "earthworm effect". Mud has 1.3× plant fertility vs
   * dirt's 1.0×, permanently enriching the soil they pass through.
   */
  soilEngineer?: boolean
  /**
   * When true, this species uses active camouflage based on colour-matching the
   * tile it stands on. The effective camouflage score becomes
   * `max(traits.camouflage, colorMatchScore)`, where colorMatchScore is 1 when
   * the creature's hue exactly matches the tile's hue and falls to 0 at 90°
   * apart. Achromatic tiles (stone, metal, ice) give a flat 0.3 baseline.
   *
   * This creates an evolutionary feedback loop: cryptic individuals on earthy
   * tiles that happen to share those hues survive predation better, so over
   * generations the population drifts toward the local substrate colour.
   */
  cryptic?: boolean
  /**
   * High-contrast stripe or spot pattern that breaks the creature's apparent outline
   * at range, reducing predator detection beyond DISRUPTION_NEAR_TILES.
   * Up close the pattern is legible; the effect only applies at distance.
   * Models zebra stripes, jaguar spots, and disruptive camouflage.
   */
  disruptivePattern?: boolean
  /**
   * When true, this creature eats plant seedlings even when not hungry,
   * preventing succession — the mechanism behind savanna and prairie maintenance.
   * Only targets plants younger than SEEDLING_MAX_AGE seconds.
   */
  clearingMaintainer?: boolean
  /**
   * False-eye markings that redirect predator strikes to non-vital body parts.
   *
   * When a predator lands a killing blow, there is a 40% chance the strike hits
   * the eyespot (wing edge, tail tip) rather than the body. The prey survives with
   * a burst of speed, while the predator gets almost nothing from the missed kill.
   * Models the real-world bite marks found on butterfly wings at eyespot locations.
   */
  eyespots?: boolean
  /**
   * Dark dorsal surface and pale ventral surface that cancel out the shadow cast
   * by overhead lighting, making the body appear flat and harder to resolve as
   * three-dimensional prey.
   *
   * Adds a fixed +0.25 to the effective camouflage score independent of the
   * cryptic tile-matching system — structural concealment that does not evolve
   * away in a single generation. The most common coloration pattern in vertebrates.
   */
  countershaded?: boolean
  /**
   * Cephalopod/chameleon-type active color change: the creature updates its hue
   * every 5 seconds to match the tile it is standing on.
   *
   * When standing still and hue-matched, the creature's `cryptic` detection
   * advantage applies at full strength. During the 2-tick transition (after the
   * hue updates), the creature is exposed — chromatophore pigment cells are
   * briefly in an incoherent intermediate state. The effect requires `cryptic:
   * true` to influence predator detection; without it, the hue shift is cosmetic.
   *
   * Models cuttlefish, cephalopods, and some species of chameleon. The hue
   * persists in traits and is inherited by offspring — creating selection pressure
   * for adaptable-hue lineages on variable substrates.
   */
  activeChromatophores?: boolean
  /**
   * Digging creatures that physically mix soil layers, bringing buried nutrients
   * and infertile substrate to the surface where plants can use them.
   *
   * When the creature walks over sand, stone, ash, or bone tiles, there is a
   * small chance per tick the tile is converted to dirt — reclaiming barren
   * areas. Complements soilEngineer (which enriches dirt→mud); bioturbators
   * reclaim the layer beneath. Models earthworms, moles, ants, crabs.
   */
  bioturbator?: boolean
  /**
   * Rooted plants that physically bind loose soil with their root systems,
   * preventing erosion of the substrate they are anchored in.
   *
   * Each tick, the plant has a small chance to convert adjacent sand tiles
   * (within 2 tiles horizontally) into stable dirt — modelling the way riparian
   * trees lock in riverbank soil and prevent slumping. Only applies to
   * `move.kind === 'root'` creatures. Models willows, alders, mangroves.
   */
  rootBankStabilizer?: boolean
  /**
   * Industrial polluter: the creature deposits soot (ash) on dirt and grass tiles
   * as it moves, darkening the substrate. Ash has 0.7× plant fertility compared
   * to dirt's 1.0× — a penalty that models real soot smothering.
   *
   * The primary ecological effect is selection pressure: cryptic prey species on
   * ash tiles benefit from dark/blue-gray hue matching (ash hue ≈270°), causing
   * dark morph individuals to survive predation better (industrial melanism).
   * When pollution clears (polluter removed), lighter morphs recover their
   * advantage on the original substrate. Models the peppered moth case study.
   */
  polluter?: boolean
  /**
   * Cave bats roost on underground surfaces. While underground they slowly
   * deposit guano onto floor tiles, boosting caveNutrient for cave plant growth.
   */
  caveBat?: boolean
  /**
   * Plants that supplement nutrient-poor substrate by trapping and digesting prey.
   *
   * Inverts the fertility curve: carnivorous plants breed *faster* on low-fertility
   * tiles (stone, sand, ash) and slower on rich soil, out-competing normal flora on
   * barren ground. They may also root on stone — normally infertile for plants.
   *
   * Breed cooldown uses `max(0.1, 2.0 − fertilityAt)` instead of `fertilityAt`:
   *   stone (f=0.3) → factor 1.7 → ~5.7× faster than normal plants
   *   sand  (f=0.5) → factor 1.5 → 3×
   *   dirt  (f=1.0) → factor 1.0 → neutral
   *   mud   (f=1.3) → factor 0.7 → slower, outcompeted by normal plants
   *
   * Models sundews, pitcher plants, butterworts on acidic bogs and volcanic rock.
   */
  carnivorousPlant?: boolean
  /**
   * Mechanism by which carnivorous plants trap prey.
   * 'snap': two-touch trigger (Venus flytrap model).
   * Other trap types added by later issues.
   */
  trapType?: 'snap' | 'pitfall' | 'sticky'
  /**
   * Salinity tolerance range [min, max] for estuarine creatures.
   * Creatures outside this range pay an osmotic-stress hunger penalty.
   * undefined = no salinity constraint (works in any salinity).
   */
  salinityTolerance?: { min: number; max: number }
  /**
   * Heat-sensitive species (cold-water fish, trout analogues) suffer increased
   * hunger during warm seasons. Groundwater-fed tiles (high moisture from
   * groundwater percolation) act as thermal refugia — the stress is
   * proportionally relieved by local moisture.
   *
   * Models how spring seeps provide critical cold-water refuge for trout and
   * salmon in warming climates.
   */
  heatSensitive?: boolean
  /**
   * Aerial roots create structural shelter in tidal zones. When true, juvenile
   * creatures within 8 tiles receive a doubled nursery hunger bonus.
   */
  aerialRoots?: boolean
  /**
   * Drastically reduced basal metabolic rate — inspired by cave-adapted
   * species (cave olm, cave fish) that can survive months without food.
   *
   * When true, the hunger increment is multiplied by 0.1, making the creature
   * burn energy at 10% of the normal rate. Reproduction rate is also halved
   * (these are extreme K-strategists). No special tile requirement — the flag
   * applies anywhere, but it is most meaningful in nutrient-scarce environments.
   */
  slowMetabolism?: boolean
  /**
   * Invasive species benefit from enemy release — the absence of co-evolved
   * predators and parasites in their introduced range.
   *
   * Effects:
   *   - Breed cooldown × 0.67 (1.5× faster reproduction rate)
   *   - Effective disease immunity boosted by +0.56 (base 0.2 → 0.76),
   *     representing 70% reduced disease susceptibility
   *
   * The effect is unconditional (no region tracking yet). It models the
   * population explosion seen in successful invasions before native ecosystems
   * adapt: cane toads, zebra mussels, kudzu vine.
   */
  invasive?: boolean
  /**
   * Allelopathic plants secrete chemicals that suppress the growth of nearby
   * competitors. Any rooted plant within `ALLELOPATHY_RADIUS` tiles whose
   * blueprint does NOT have `novelCompoundResistant: true` gets a 30% breed-
   * cooldown penalty (breedCooldown × 1.3) applied each tick.
   *
   * Models garlic mustard, black walnut juglone, and invasive Phragmites
   * secreting allelopathic compounds into the soil.
   */
  allelopathic?: boolean
  /**
   * This plant has evolved or already carries resistance to allelopathic
   * compounds in its habitat. Nearby allelopathic plants do not suppress its
   * growth rate.
   *
   * In an invasive-species context, this trait can spread through a native
   * plant population exposed to an allelopathic invader over many generations.
   */
  novelCompoundResistant?: boolean
  /**
   * How effectively this species competes with others for shared resources and
   * space. Contributes to competitive pressure experienced by neighbours of
   * different species.
   *
   * Default 1.0. Invasive generalists typically use 2.0, reflecting broader
   * niche breadth and resource-use efficiency. Specialists may be < 1.0 in
   * out-of-niche conditions.
   *
   * Used in the competitive exclusion formula: when total competitive pressure
   * from other species nearby exceeds COMPETITIVE_THRESHOLD, breeding rate drops.
   */
  competitiveAbility?: number
  /**
   * Electroreceptive creatures (sharks, platypuses) detect the weak electrical
   * fields generated by muscle contractions and nerve activity in other animals.
   * This sense is independent of visual camouflage — even perfectly colour-
   * matched prey are fully detectable by their bioelectric signature.
   *
   * When true, this predator sees all prey at `baseCamouflage = 0` regardless
   * of the prey's cryptic, chromatophore, or countershading flags.
   */
  electroreceptive?: boolean
  /**
   * Warm-blooded creatures maintain a body temperature above ambient via
   * metabolic heat generation. This makes them detectable to predators with
   * `infraredVision: true` regardless of visual camouflage.
   */
  warmBlooded?: boolean
  /**
   * Infrared thermoreceptive predators (pit vipers, vampire bats) detect the
   * heat signatures of warm-blooded prey. When this predator encounters a prey
   * with `warmBlooded: true`, `baseCamouflage` is set to 0, bypassing all
   * visual-camouflage defences.
   */
  infraredVision?: boolean
  /**
   * Cognitive capacity on a 0–1 scale. Increases daily energy expenditure by
   * `brainSize × 0.2` (a creature with brainSize=1 burns 20% more energy than
   * one with brainSize=0, all else equal). Enables access to tool-use and social
   * learning mechanics in future epics.
   *
   * Models the real energetic tradeoff: the human brain uses ~20% of basal
   * metabolic rate despite being only 2% of body mass.
   */
  brainSize?: number
  /**
   * Fish-type creatures with a lateral line organ detect water pressure waves
   * and micro-turbulence from nearby moving creatures. The lateral line
   * bypasses visual camouflage within a short radius — but only when the
   * predator is in a water or mud tile (the medium that transmits the
   * pressure signal).
   *
   * Models how blind cave fish still school and hunt, and why predatory fish
   * in murky water find prey that would be visually invisible.
   */
  lateralLine?: boolean
  /**
   * Mantis shrimp and cephalopods detect polarized light reflections from
   * iridescent surfaces, including the cryptic colour-matching camouflage used
   * by flatfish and cephalopods themselves.
   *
   * When true, this predator strips the `cryptic` tile-matching bonus from prey
   * camouflage — but does NOT override base `traits.camouflage`. A cryptic prey
   * that would have had `baseCamouflage ≈ 1` falls back to `traits.camouflage`
   * (default ≈ 0.2). Unlike electroreception, polarized light is weaker:
   * it reveals the colour match, not the animal's presence per se.
   */
  polarizedVision?: boolean
  /**
   * Cephalopods and mantis shrimp emit polarized skin patterns as covert
   * mating signals. Other same-species polarizedVision creatures detect these
   * beacons at 2× normal sight range. Predators without polarizedVision are
   * blind to the signal — it cannot be eavesdropped.
   */
  polarizedSkin?: boolean
  /**
   * Species-level opt-in to the food-washing cultural innovation.
   *
   * When true, individuals of this species can discover — or learn from kin —
   * the practice of rinsing food near water before eating it. The behavior is
   * per-individual (`Creature.learnedFoodWashing`) and spreads socially.
   * Default false; only meaningful for intelligent social animals.
   */
  canLearnFoodWashing?: boolean
  /**
   * When true, individuals of this species can independently invent named
   * techniques and transmit them to conspecifics via social learning.
   * Techniques spread culturally like memes — discovered by rare spontaneous
   * innovation and passed peer-to-peer within sight range.
   */
  canInnovateTechniques?: boolean  // can independently invent and transmit cultural techniques
  /**
   * How readily this species transmits and acquires learned behaviors, 0–1.
   *
   * A multiplier on cultural transmission probability in both directions —
   * how fast a demonstrator passes a behavior on, and how fast an observer
   * picks it up. Works alongside `brainSize`: smarter, more social species
   * learn fastest.
   *
   * Default (absent or 0.5) preserves the original 4% / 40% food-washing
   * transmission rates. High values (1.0) make the species hyper-social
   * learners; low values (0.1) make cultural transmission rare even between
   * close kin. Also moderates forgetting: high socialLearningRate species
   * forget learned behaviors more slowly because active social reinforcement
   * keeps the knowledge alive.
   */
  socialLearningRate?: number
  /**
   * Species-level opt-in to the elder knowledge mechanic.
   *
   * When true, creatures in the last 35% of their natural lifespan
   * (`ageSeconds > lifespanSeconds * 0.65`) are "elders" who carry accumulated
   * cultural knowledge: rare migration routes, drought-time water sources, safe
   * foraging patches. Elders get a 1.4× sight bonus and always emit food-location
   * scents after eating (regardless of cooperation level). Younger members near
   * an elder learn by proximity (+1.2× sight). When no elder of the species
   * survives anywhere, the population enters a knowledge gap (0.85× sight) until
   * new elders emerge. Models elephant matriarch and orca grandmother effects.
   * Default false; only meaningful for long-lived social animals.
   */
  elderWisdom?: boolean
  /**
   * Phenological calendar: GDD thresholds for seasonal life-history events.
   * GDD (0–1000) is derived from world elapsed time and seasonPeriod — 0 in
   * midwinter, 1000 at summer peak. When seasonAmplitude is 0 (no seasons),
   * GDD is always 1000 and all phenological gates are permanently open.
   */
  phenology?: {
    /** GDD at which breeding season opens. 0 or undefined = always breeding. */
    breedingGdd?: number
  }
  /**
   * Plants with UV nectar guides have UV-reflective petal patterns that serve
   * as landing guides for UV-sensitive pollinators. These guides are invisible
   * to creatures without UV vision.
   */
  uvNectar?: boolean
  /**
   * Pollinators with UV vision detect UV-reflective petal patterns on flowers,
   * allowing them to locate UV-nectar plants at full sight range — versus the
   * 3-tile contact range for non-UV pollinators.
   */
  uvSensitive?: boolean
  /**
   * Stream invertebrate that occasionally enters the water column and drifts
   * passively with current. Delivers food to downstream fish. Issue #3373.
   */
  canDrift?: boolean
  /**
   * Records natal X position at birth; as adults, these fish migrate back toward
   * that position to spawn. Spawning is fatal — the fish dies and deposits marine
   * nutrients into the headwater ecosystem. Issue #3374.
   */
  anadromous?: boolean  // records natal X at birth; adult drives toward it to spawn and die
  /**
   * Photoperiod breeding gate. Issue #3360.
   * 'long' = only breeds when seasonFactor >= 1 (long days, summer).
   * 'short' = only breeds when seasonFactor <= 1 (short days, winter/autumn).
   * undefined = no photoperiod restriction.
   */
  breedingPhotoperiod?: 'long' | 'short'
  /**
   * When true and deep winter (seasonFactor < 0.7), metabolic rate is reduced —
   * the creature burns hunger more slowly. Models hibernation / torpor in species
   * that slow down in response to short photoperiods. Issue #3360.
   */
  dormancyPhotoperiod?: boolean
  /**
   * Preferred flow-velocity zone for aquatic creatures. Creatures in their
   * preferred zone get a slight hunger relief; in a mismatched zone, a mild
   * penalty. Only meaningful for aquatic species. Issue #3370.
   * 'riffle' = fast oxygenated water, 'run' = intermediate, 'pool' = slow silted.
   */
  flowZonePreference?: 'riffle' | 'run' | 'pool'
  /**
   * Leaves breeding grounds when the season turns and returns in spring.
   * Creature drives toward `winteringX` when the season is falling and toward
   * `summerX` when rising. Issue #3321.
   */
  migratory?: boolean
  /** X tile of the wintering ground. Default: left quarter of the world. */
  winteringX?: number
  /** X tile of the breeding/summer ground. Default: right quarter of the world. */
  summerX?: number
  /**
   * Creature carries an internal magnetic compass: it orients directly toward
   * its seasonal destination without needing visible landmarks. Flyers with this
   * flag maintain altitude during migration. Issue #3322.
   */
  magnetoreceptive?: boolean
  /**
   * Terrain materials that count as suitable stopover habitat for refueling
   * during migration. When a migrating creature lands on a matching tile it
   * pauses, refuels, and resumes. Creatures with this set deplete fat while
   * migrating; those without it are not fat-tracked. Issue #3324.
   */
  stopoverHabitat?: string[]
  /**
   * Seeds of this species require cold stratification before they can germinate.
   * Dispersed seeds accumulate cold exposure (when seasonFactor < 0.9); only after
   * 120 seconds of cold do they become capable of germinating. Models temperate
   * tree seeds that need winter to break dormancy. Issue #3352.
   */
  requiresStratification?: boolean
  /**
   * Seeds of this species require fire heat to break their hard coat. Dormant
   * seeds are scarified when lava is detected at their tile or an adjacent tile;
   * scarified seeds then germinate at 10× the normal probability. Models
   * serotinous cones (lodgepole pine, banksia) and heat-scarified annuals.
   * Issue #3353.
   */
  fireGerminator?: boolean
  /**
   * Seeds of this species germinate preferentially in light gaps — openings in the
   * canopy created by treefall or disturbance. When `lightGrid` at the seed's tile
   * exceeds 0.4, the seed attempts immediate germination. Models gap-dependent
   * pioneers like SUNLEAF and BRAMBLE. Issue #3351.
   */
  lightGapGerminator?: boolean
  /**
   * Viability half-life of dormant seeds in seconds. Seeds decay exponentially:
   * viability = 0.5^(age / seedLongevity). Short-lived (transient bank, ~150 s)
   * seeds must germinate within one season or die. Long-lived (persistent bank,
   * ~1800 s) seeds can outlast multiple extinctions. Defaults to 600 s if unset.
   * Issue #3354.
   */
  seedLongevity?: number
  /**
   * Biome zones this species can establish in. When set, creatures and seeds
   * of this species cannot breed or germinate in regions outside this list.
   * Uses `biomeZoneAt(w, y)` to classify the current tile's region.
   * Leave undefined to allow establishment anywhere. Issue #3378.
   */
  biomeRequirements?: BiomeZoneType[]
  /**
   * This species can form symbiotic associations with soil fungi, becoming a
   * node in the mycorrhizal network. Connected plants share nutrients and
   * chemical signals. Issue #3329.
   */
  mycorrhizalPartner?: boolean
  /**
   * This species REQUIRES fungal colonization to establish or survive beyond
   * the seedling stage. Without a mycorrhizal partner within HYPHAE_RANGE
   * tiles, seedlings die and adults face a starvation penalty. Issue #3333.
   */
  obligateMycorrhizal?: boolean
  /**
   * This species preferentially hunts creatures whose blueprintId appears in
   * this list. When a `biocontrolTarget` creature is within attack range, the
   * agent prioritizes it over other prey (2× attack bonus vs. target, 0.5×
   * vs. non-target). Models specialist biocontrol agents introduced to suppress
   * invasive species. Issue #3368.
   */
  biocontrolTargets?: string[]
  /**
   * True if this species is itself a biocontrol introduction rather than a
   * naturally occurring species. Used for Field Guide tracking. Issue #3368.
   */
  biocontrolAgent?: boolean
  /**
   * This species transitions through complete metamorphosis: egg → larva → pupa → adult.
   * Eggs hatch into `larvaeBlueprint` creatures instead of adults. Issue #3336.
   */
  holometabolous?: boolean
  /**
   * BlueprintId of the larval form. Eggs from this adult species hatch as this blueprint.
   * Only meaningful when `holometabolous: true`. Issue #3336.
   */
  larvaeBlueprint?: string
  /**
   * This creature transforms into this blueprintId when it reaches `metamorphosisAge`.
   * Used on larval and pupal blueprints to encode the lifecycle chain. Issue #3336.
   */
  metamorphosesInto?: string
  /**
   * Age in seconds at which metamorphosis is triggered. When `c.ageSeconds` exceeds
   * this value, the creature switches to `metamorphosesInto` blueprint. Issue #3336.
   */
  metamorphosisAge?: number
  /**
   * Seconds this pupa stage lasts before adult emerges. Only relevant for pupal blueprints
   * where the transition is time-gated, not age-gated. Issue #3336.
   */
  pupalDuration?: number
  /**
   * What larvae of this species eat, overriding the normal trophic level.
   * When set and the creature has lifeStage === 'larva', the sim uses this tag
   * instead of diet.eats to determine valid prey. Enables niche separation: the
   * caterpillar eats leaves while the butterfly drinks nectar. Issue #3337.
   */
  larvalTrophicLevel?: 'plant' | 'meat' | 'scavenger'
  /**
   * What adults of this species eat, overriding the normal trophic level.
   * 'none' means the adult stage does not eat at all — models mayflies and some
   * moths that live only to breed. When set to a non-none value, overrides
   * diet.eats for adult-stage creatures. Issue #3337.
   */
  adultTrophicLevel?: 'plant' | 'meat' | 'nectar' | 'none'
  /**
   * Extra vulnerability of this pupa to predation, [0, 1].
   * When non-zero, a predator eating this pupa gets (1 + pupalVulnerability) ×
   * normal meal fill — making pupae more rewarding prey and therefore more
   * targeted by opportunistic predators. 0 = no extra vulnerability (default).
   * Issue #3338.
   */
  pupalVulnerability?: number
  /**
   * This species undergoes incomplete metamorphosis: egg → nymph (instars) → adult.
   * Eggs from this adult hatch as the nymph form (`nymphBlueprint`). Issue #3340.
   */
  hemimetabolous?: boolean
  /**
   * BlueprintId of the nymph form. Eggs from this adult hatch as this blueprint.
   * Only meaningful when `hemimetabolous: true`. Issue #3340.
   */
  nymphBlueprint?: string
  /**
   * Number of moults before the nymph becomes an adult. Default 3. Issue #3341.
   */
  instarCount?: number
  /**
   * Seconds per instar before the next moult is triggered. Default 30. Issue #3341.
   */
  instarDuration?: number
  /**
   * Extra predation fill bonus during moulting. Analogous to pupalVulnerability.
   * When non-zero, a predator eating a moulting nymph gets (1 + moultVulnerability) ×
   * normal fill — soft-shelled nymphs are easier prey. Issue #3341.
   */
  moultVulnerability?: number
  /**
   * Spider-type creatures that spin web tiles between solid anchor points.
   * Web tiles passively capture small flying creatures and degrade over time.
   * Issue #3420.
   */
  webSpinner?: boolean
  /** Radius within which webs are placed, in tiles. Default 4. Issue #3420. */
  webRange?: number
  /** Seconds between placing a web tile. Default 5. Issue #3420. */
  webBuildInterval?: number
  /**
   * When true, this creature can pick up and carry portable tile materials.
   * Issues #3412, #3418.
   */
  objectManipulator?: boolean
  /**
   * When true, this creature actively collects nest materials and delivers them
   * to a chosen nest site. Eggs laid near a complete nest hatch faster. Issue #3418.
   */
  nestBuilder?: boolean
  /** Materials this nestBuilder collects (e.g. ['grass', 'moss']). Issue #3418. */
  nestMaterials?: string[]
  /** Number of tiles needed to consider the nest complete. Default 8. Issue #3418. */
  nestCompleteAt?: number
  /** Hatch time multiplier for eggs near a complete nest. Default 0.7 (30% faster). Issue #3418. */
  nestHatchBonus?: number
  /** Radius in tiles within which eggs benefit from the nest. Default 3. Issue #3418. */
  nestRadius?: number
  /**
   * When true, this creature physically excavates soil tiles (dirt, mud, sand,
   * grass, snow, ash) to dig a burrow tunnel. The first tile dug becomes the
   * creature's tracked burrow entrance (burrowX, burrowY). Issue #3419.
   */
  burrowDigger?: boolean
  /**
   * Maximum food reserves this creature can store in its burrow, on the 0–1
   * hunger scale. Drawn from when starving at the burrow. Default 0.3. Issue #3419.
   */
  burrowCacheSize?: number
  /**
   * Eusocial worker that builds termite-mound tiles upward from its position.
   * Each tick has a small chance to place a mound tile above the worker,
   * growing the colony's mound over time. Issue #3421.
   */
  termiteWorker?: boolean
  /**
   * Creature that prefers to live near termite-mound tiles.
   * When not within range of a mound, movement is dampened, creating
   * a tendency to find and stay near mound habitat. Issue #3421.
   */
  moundCommensal?: boolean
  /**
   * Predator that destroys termite-mound tiles and feeds on the colony within.
   * Breaking mound tiles reduces hunger and releases nutrients into surrounding
   * soil via caveNutrient. Issue #3421.
   */
  moundDestroyer?: boolean
  /**
   * This species uses hard objects (rock, metal, stone tiles) as anvils to crack
   * open hard-shelled prey. Without a stone/metal tile within 3 tiles, it cannot
   * eat hard-shelled creatures. Issue #3413.
   */
  anvilUser?: boolean
  /**
   * This species has a shell so hard that only an anvilUser predator can crack
   * it open. Non-anvilUser predators cannot eat this creature at all. Issue #3413.
   */
  hardShelled?: boolean
  /**
   * This species fashions stick-like tools to probe into burrow entrances and
   * extract hidden prey. Unlike regular predators, it can attack creatures that
   * are inBurrow. Extraction is slightly less efficient than a direct kill. Issue #3414.
   */
  stickProber?: boolean
  /**
   * Hunger reduction applied per stick-probe extraction (0–1 scale).
   * Defaults to 0.08 when unset. Only meaningful when stickProber is true. Issue #3414.
   */
  stickProbeDamage?: number
  /**
   * When true, this creature seeks out and moves into vacant built structures
   * (abandoned nests, burrows, mounds) left by dead owners. Gains shelter safety
   * similar to burrowing creatures while occupying a structure. Issue #3423.
   */
  secondaryColonizer?: boolean
  /**
   * Types of structures this secondary colonizer will occupy.
   * Values match structure type keys: 'nest' | 'burrow' | 'mound'. Issue #3423.
   */
  colonizedStructure?: string[]
  /**
   * When true, this creature builds dam structures by placing wood tiles across
   * water channels, backing up water flow into ponds. Issue #3422.
   */
  damBuilder?: boolean
  /**
   * When true, this creature memorizes its birth position as a home landmark
   * and navigates back when displaced. Young creatures follow experienced adults.
   * Issue #3326.
   */
  landmarkMemory?: boolean
  /**
   * Carrying capacity for this species. When the species population exceeds this
   * value, reproduction is progressively penalized. At 1.5× the cap, 30% of the
   * population is culled per overshoot event. Issue #3287, #3292.
   */
  populationCap?: number
  /**
   * Minimum viable population for normal reproduction (Allee effect).
   * When the species population falls below this threshold, reproduction rate is
   * scaled down proportionally to population / alleeThreshold. Issue #3288.
   */
  alleeThreshold?: number
  /**
   * Body mass in relative units (1.0 = reference size).
   *
   * Used for Kleiber's metabolic scaling (hunger rate ∝ bodyMass^0.75) and the
   * size-based predation gate (prey must be within mass ratio [0.1, 3.0] of
   * predator). Default 1.0 when undefined. Issues #3269, #3272, #3273.
   */
  bodyMass?: number     // body mass in relative units (1.0 = reference size); default 1.0
  /**
   * When true, this species participates in the Kestrel Kingdom mechanic.
   *
   * At each seasonal boundary the individual with the highest cumulative
   * `mealsEaten` is crowned Monarch. The Monarch hunts at 110% speed.
   * There is no court, no succession plan — the crown is re-awarded each
   * season regardless of what happened to the previous holder. Issue #3304.
   */
  kestrelKingdom?: boolean
  /**
   * When true, this species stays near its nest when eggs are present, and
   * intercepts predators approaching those eggs. Issue #3258.
   */
  parentalCare?: boolean
  /** Tiles within which eggs are protected by a guarding parent. Default 5. Issue #3258. */
  parentalRadius?: number
  /** Hatch time multiplier for guarded eggs (< 1 = faster). Default 0.8. Issue #3258. */
  broodProtection?: number
  /**
   * When true, this species lays its eggs in a host species' nest rather than
   * building its own, leaving the hosts to raise its young. Issue #3260.
   */
  broodParasite?: boolean
  /** Blueprint IDs of compatible host species for this brood parasite. Issue #3260. */
  broodParasiteHost?: string[]
  /**
   * Population warning threshold. When the live count falls below this value
   * (but is still above zero) the species is at high extinction risk.
   * The field guide shows a warning indicator. Issues #3284, #3285.
   */
  minViablePopulation?: number
  /**
   * r/K selection position: 0=extreme r-selected (fast, many small offspring),
   * 1=extreme K-selected (slow, few well-provisioned offspring). Issue #3256.
   */
  rK?: number
  /**
   * Mating system: affects reproduction rate and mate-finding behavior.
   * Issue #3257.
   */
  matingSystem?: 'monogamy' | 'polygyny' | 'polyandry' | 'promiscuity'
  /**
   * When true, the individual dies immediately after its first successful
   * reproduction (big-bang reproduction strategy). Issue #3259.
   */
  semelparous?: boolean
  /**
   * How reproductive rate varies with age. Issue #3261.
   */
  ageReproductionCurve?: 'peak-early' | 'peak-middle' | 'peak-late'
  /** When true, this species ratifies a Constitution when population first reaches 10. Issue #3296. */
  crabConstitution?: boolean
  /** When true, this species holds periodic Town Hall votes. Issue #3297. */
  duckDemocracy?: boolean
  /** When true, nearby conspecifics provide defensive spine-sharing, increasing effective toxicity. Issue #3301. */
  hedgehogHealthcare?: boolean
  /** When true, this species only cooperates with burrowing conspecifics; ignores non-diggers. Issue #3317. */
  xerusXenophobia?: boolean
}

/**
 * Latitudinal biome classification, used to gate species establishment.
 *
 * `biomeZoneAt(w, y)` returns one of these based on the tile's y-row.
 * Zones map the world's height into rough latitudinal bands: the sky rows
 * are the warmest (tropical), the deep underground rows are the coldest (ice-cap).
 */
export type BiomeZoneType =
  | 'tropical-rainforest'
  | 'tropical-savanna'
  | 'desert'
  | 'temperate-grassland'
  | 'temperate-forest'
  | 'boreal'
  | 'tundra'
  | 'ice-cap'

/**
 * Which half of the food web something belongs to.
 *
 * Two buckets rather than the six `CREATURE_GROUPS`, and the reason is that a
 * record is only worth holding if something is competing for it. Split six ways,
 * a land with one hunter in it hands that hunter every hunter record forever and
 * they stop meaning anything. Plant against animal is the one split where both
 * sides are always crowded.
 */
export type LifeKind = 'plant' | 'animal'

/** Display order wherever the two are shown side by side. Plants first. */
export const LIFE_KINDS: LifeKind[] = ['plant', 'animal']

// ---------------------------------------------------------------------------
// Live world state
// ---------------------------------------------------------------------------

export type CreatureMood = 'wander' | 'hunt' | 'flee' | 'eat' | 'rest' | 'mate'

/**
 * The small part of a creature that is its own rather than its species'.
 *
 * A blueprint is shared by every creature that has it — one object, in
 * `WorldState.blueprints`, read by all of them. That is the premise the whole
 * game rests on and it is not up for negotiation, so heritable variation cannot
 * live in the blueprint. It lives here instead: per-creature numbers applied
 * *on top of* the species, passed from parents to children with a nudge.
 *
 * Everything here is deliberately a modifier rather than a value. A hopper's
 * speed is still the hopper's speed; this says whether this particular hopper is
 * a little quicker than its parents were. It also means a trait can never make a
 * creature into something the blueprint didn't describe — the food chain (size
 * and tags) and the economics of eating (`hungerRate`, `breedAt`) are not in
 * here on purpose, because those are what the ecosystem was balanced against.
 *
 * See `domain/traits.ts` for how these are inherited and what reads them.
 */
export interface Traits {
  /** Multiplier on `move.speed`. */
  speed: number
  /** Multiplier on `senses.sight`. */
  sight: number
  /** Multiplier on `diet.lifespanSeconds` — and so on breeding age with it. */
  lifespan: number
  /** Hue rotation applied to the whole palette, in degrees. Wraps. */
  hue: number
  /**
   * Multiplier on the palette's lightness.
   *
   * Carried alongside `hue` because hue rotation does nothing whatsoever to a
   * grey: a species drawn in white and charcoal would drift for a thousand
   * generations and never once look different. Clamped far tighter than the
   * others — a line that drifted to twice its lightness would be a white smear
   * against the sky, and one at half would vanish into the dark.
   */
  shade: number
  /**
   * Multiplier on the hunger-reach bonus — how much further than plain sight a
   * hungry creature will sense food.
   *
   * A wide-ranging line drifts above 1 and picks up food earlier in a search,
   * which pays off when food is spread thin. A stay-close line drifts below 1
   * and hunts at shorter range, which matters less when prey is dense.
   * Neither is universally better; which wins depends on the world.
   */
  roam: number
  /**
   * How strongly this creature defends a home area.
   *
   * Controls both the pull back toward home when wandering, and the radius
   * within which well-fed individuals attack non-prey non-predator intruders.
   * Heritable — a line under pressure from neighbors can evolve toward a
   * more defended range over generations. Neutral at 0.5.
   */
  territorial: number
  /**
   * Body size relative to the blueprint.
   *
   * Larger creatures are slower but harder to predate. Smaller ones move faster
   * but are easier prey. Drifts each generation in [0.8, 1.2].
   */
  size: number
  /**
   * How well this creature blends into its background.
   *
   * 0 = no camouflage (full visibility), 1 = highly camouflaged (hard to spot).
   * Still creatures benefit the most — a motionless animal with high camouflage
   * is nearly invisible until a predator is almost on top of it. Moving gives
   * most of it away. Heritable — a hunted line can evolve toward stillness.
   */
  camouflage: number
  /**
   * How toxic this creature is to those that eat it.
   *
   * 0 = harmless, 1 = fully venomous. Neutral 0.
   * A predator that eats a creature with toxicity > 0.5 gains less nutrition
   * (meal value is halved) and is briefly stunned — barely moving for 1.5 s.
   * High-toxicity lineages can drift toward vivid colouring over generations.
   */
  toxicity: number
  /**
   * Tendency to share food discoveries with same-species members.
   *
   * 0 = solitary, 1 = highly cooperative. Creatures above 0.5 emit a
   * food-beacon scent when they eat and follow beacons left by kin. Those
   * below neither emit nor follow. Creates a fork: loners vs. clusters.
   */
  cooperation: number
  /**
   * Activity preference: -1 = fully nocturnal, 0 = crepuscular, +1 = fully diurnal.
   *
   * During the creature's inactive phase (day for nocturnal, night for diurnal)
   * speed and sight are reduced by up to 50%. Neutral at 0 — no preference.
   * Heritable — a line that survives better at night drifts toward nocturnal.
   */
  diurnal: number
  /**
   * Resistance to disease.
   *
   * 0 = fully susceptible, 1 = immune. Higher immunity means a sick creature
   * is more likely to survive the disease and less likely to catch it from a
   * neighbour. Heritable — a population under disease pressure can evolve
   * resistance over generations. Neutral at 0.2.
   */
  immunity: number
  /**
   * Multiplier on the time this creature waits between births.
   *
   * Below 1 means a shorter cooldown — fast breeders that swamp food-rich
   * environments. Above 1 means longer waits — slow breeders that trade
   * quantity for whatever makes each offspring more likely to survive.
   * `effectiveCooldown = TUNING.breedCooldown * reproductionCooldown`.
   * Neutral at 1. Range [TRAIT_MIN, TRAIT_MAX].
   */
  reproductionCooldown: number
  chronotype?: number  // phase offset trait: negative = early bird, positive = late owl, range [-1, 1]
}

/** One living thing in the world. */
export interface Creature {
  id: number
  blueprintId: string
  /** World-tile coordinates of the sprite's top-left corner. */
  x: number
  y: number
  vx: number
  vy: number
  /** Facing: 1 = right, -1 = left. */
  facing: 1 | -1
  /** 0 = stuffed, 1 = starving. */
  hunger: number
  /** Seconds spent at hunger >= 1. */
  starving: number
  ageSeconds: number
  /**
   * Seconds spent somewhere this creature can't survive — underwater for a
   * lander, out of water for a fish. One timer covers both.
   */
  distress: number
  mood: CreatureMood
  /** Creature id this one is chasing or fleeing, if any. */
  targetId: number | null
  /** Idle wander direction, -1..1. */
  drift: number
  /** Animation clock, ms. */
  animMs: number
  /** True once it's on the ground (walkers only). */
  grounded: boolean
  /** Cooldown before it can breed again, seconds. */
  breedCooldown: number
  /** Lifetime tally of meals eaten — the inspector's evidence that it hunts. */
  mealsEaten: number
  /** Lifetime tally of offspring. */
  children: number
  /**
   * The creature the parasite is currently riding.
   *
   * Null for non-parasites and unattached parasites. Set by `look()` when the
   * parasite first contacts a valid host; cleared when the host dies. While set,
   * the parasite's position is locked near the host and the host's hunger drains.
   */
  hostId?: number | null
  /**
   * Key life events in chronological order (max 20).
   *
   * Optional so old serialised worlds without it don't crash — always guard
   * reads with `?? []`. Written by tickCreatures at: birth, first meal,
   * first offspring, and every 10th offspring.
   */
  lifeLog?: Array<{ elapsed: number; text: string }>
  /**
   * How far back this creature's line goes. 1 was placed or seeded by hand or by
   * the world; anything higher was born here, to a parent one lower.
   *
   * Counts ancestry rather than population, so it survives a crash: a species
   * can dwindle to a single individual and its line keeps its depth.
   */
  generation: number
  /**
   * What this one inherited, as multipliers on its species.
   *
   * Neutral for anything that wasn't born here, which is what makes a species
   * that dies out and is placed again genuinely start over rather than resume.
   */
  traits: Traits
  /**
   * What the player called it.
   *
   * Only ever offered for a creature holding the longevity record — naming is
   * the moment a creature stops being one of the hoppers and becomes *yours*,
   * and it is worth more if it has to be earned.
   */
  name: string | null
  /** BlueprintId of the plant seed this pollinator is currently carrying. Null if not carrying. */
  carryingSeed: string | null
  /** Seconds remaining before the carried seed auto-drops. */
  seedTimer: number
  /**
   * Consecutive sense passes spent hunting the same target without success.
   * Resets when the target changes or a meal is eaten. Used for stuck detection.
   */
  huntPassCount: number
  /**
   * Id of the last prey this creature got physically stuck trying to reach.
   *
   * When set, the creature treats that prey as "smelled, not seen" — it steers
   * toward it via `drift` instead of hard-locking `targetId`. This prevents the
   * oscillation loop where the stuck detector fires, cools down, and the creature
   * immediately re-locks on the same unreachable target.
   *
   * Cleared when the creature locks onto a *different* prey (fresh slate for the
   * new hunt) or successfully eats something.
   */
  huntBlockedId: number | null
  /**
   * Seconds of poison remaining after eating a toxic plant.
   *
   * While above zero the creature moves at half its normal speed. Counts down
   * each tick and returns to 0 on its own — no antidote needed.
   */
  poisoned: number
  /** X tile of where this creature was born/placed — its home centre. */
  homeX: number
  /** Y tile of where this creature was born/placed — its home centre. */
  homeY: number
  /**
   * Seconds spent hungry (above FORAGE_HUNGER) with no food target in sight.
   *
   * When this exceeds 30 s the creature is considered to be migrating: its
   * food-sensing range expands to 4× normal so it can detect distant patches
   * and walk toward them. Resets to 0 as soon as a target is found.
   */
  migrateTimer: number
  /**
   * Seconds of pack-hunting speed bonus remaining.
   *
   * Set by the sense pass when a same-species neighbour is also targeting the
   * same prey. Grants a 1.2× speed multiplier while above zero; decays each
   * tick. Only one sense-interval worth of time is granted at a time, so the
   * bonus only persists as long as coordination continues.
   */
  packTimer: number
  /**
   * How many creatures are currently hunting the same prey in this creature's pack.
   *
   * 0 = not in a pack. Updated every sense tick alongside packTimer.
   * Pushed to the inspector so the panel can say "hunting in a pack of 3".
   */
  packSize?: number
  /**
   * Seconds spent standing on quicksand.
   *
   * Walkers slow progressively as this rises (fully stopped at 8 s) and die
   * if trapped for more than 12 s. Decays at 2× speed when off quicksand.
   * Only tracked for 'walk' locomotion; other locomotion kinds ignore it.
   */
  sinking: number
  /**
   * Seconds of venom stun remaining after eating toxic prey.
   *
   * Set when the creature eats a creature with high toxicity. While above zero
   * the creature moves at 0.2× speed. Counts down each tick.
   */
  stunTimer: number
  /**
   * Seconds of symbiosis bonus remaining.
   *
   * Set by the sense pass when a symbiosis partner is within 5 tiles. Grants
   * 15% speed boost and 20% slower hunger drain while above zero. Decays each
   * tick. Only one sense-interval worth of time is granted at a time.
   */
  symbiosisTimer: number
  /**
   * Seconds of disease remaining.
   *
   * Set to 20 when infected. Counts down each tick. When it reaches 0 the
   * creature either recovers (rng < immunity * 0.8 + 0.2) or dies. While
   * positive the creature moves at 0.7× speed and can spread disease to
   * nearby animals within 4 tiles.
   */
  sick: number
  /**
   * Seconds of Jellyfish Judiciary breeding priority remaining.
   *
   * Set when the Court of Currents (a nearby drifter jelly) convenes to settle
   * an aquatic territory dispute. The winning species breeds 50% faster while
   * above zero. The court disperses immediately after the verdict and retains no
   * memory — the same species can be tried again next session. Issue #3303.
   */
  judiciaryPriorityTimer?: number
  /**
   * Whether this individual currently holds the Kestrel Kingdom throne.
   *
   * Set at each seasonal boundary on the kestrelKingdom individual with the
   * highest mealsEaten. Grants 10% hunting speed. Cleared on all individuals
   * before each re-election. When the Monarch dies mid-season the crown sits
   * vacant until the next reckoning — no interregnum protocol exists.
   * Issue #3304.
   */
  isMonarch?: boolean
  /**
   * Sprint fatigue, 0–1. Accumulates while chasing or fleeing; drains while
   * resting or eating. Above 0.5 it reduces effective speed; at 0.9 the
   * creature enters 'rest' mood until it recovers. Optional so old saves with
   * no fatigue data default to 0.
   */
  fatigue?: number
  /**
   * Whether this individual has learned to wash food before eating.
   *
   * A per-creature learned behavior, not a heritable trait — it is absent by
   * default and acquired either by rare spontaneous innovation near water, or
   * by observing a kin who already does it. Models the 1953 Koshima macaque
   * potato-washing discovery: the first documented cultural transmission in
   * non-humans.
   *
   * Only active for species with `canLearnFoodWashing: true` in their blueprint.
   * When active, eating near water yields 5% more energy per meal.
   */
  learnedFoodWashing?: boolean
  /**
   * Cultural techniques this creature knows (e.g. 'ambush-timing', 'cache-store').
   *
   * A per-creature learned set, not heritable — acquired either by rare spontaneous
   * innovation or by observing a conspecific who already knows the technique.
   * Only active for species with `canInnovateTechniques: true` in their blueprint.
   */
  innovations?: string[]  // cultural techniques this creature knows (e.g. 'ambush-timing', 'cache-store')
  /** For snap-trap plants: number of times prey has touched the trap (0–2). */
  trapTriggerCount?: number
  /** For snap-trap plants: countdown in seconds until the trigger resets. */
  trapTriggerTimer?: number
  /** For snap-trap plants: ID of the prey creature currently being digested. */
  trapDigestingId?: number
  /** Force the renderer to display a specific art frame (0-indexed). undefined = use normal animation. */
  forceFrame?: number
  /** ID of the snap-trap plant holding this creature captive; creature cannot move while set. */
  immobilizedById?: number
  /** For pitfall/sticky traps: IDs of multiple prey currently being digested. */
  trapPreyIds?: number[]
  /** For sticky traps: how many ticks this creature has been adhered (0–3). */
  adheredTicks?: number
  /**
   * For carnivorous plants: accumulated prey nitrogen from successful digestions.
   * 0–1 scale; decays over time. When above 0.2, reduces breed cooldown drain
   * at 1.5× rate — prey-rich areas produce far more carnivorous plant offspring.
   */
  nutrientStore?: number
  /**
   * Cultural dialect: which variant of the food-washing behavior this creature
   * carries. 1–999, unique per founder innovation. Populations separated by
   * barriers drift toward different values; reconnecting populations compete
   * via social transmission until one variant dominates.
   * `undefined` means the behavior is not known.
   */
  foodWashingVariant?: number
  /**
   * Per-individual deviation from the species' phenology.breedingGdd threshold.
   * Heritable with mutation — positive = breeds later, negative = breeds earlier.
   * Capped at ±200 GDD. Species without phenology.breedingGdd ignore this.
   * Default undefined = 0 (no offset from species baseline).
   */
  phenoOffset?: number
  /** Seconds remaining in an insight pause. While above zero the creature moves at 0.05× speed. */
  insightTimer?: number
  /** Total insight events this creature has had. */
  insightCount?: number
  /** Currently in passive drift (stream invertebrate released into current). Issue #3373. */
  drifting?: boolean
  /** X tile position where this creature was born (for anadromous migration). */
  natalX?: number
  /** True when the creature is actively migrating toward its seasonal destination. */
  migrating?: boolean
  /** X tile the creature is currently migrating toward. */
  migrationDestX?: number
  /** Migratory fat reserve [0, 1]. Depletes during active migration; refills at stopover habitat. */
  migratoryFat?: number
  circadianPhase?: number  // internal clock phase [0, 1]; 0 = subjective dawn, 0.5 = subjective dusk
  /** Seconds remaining of mycorrhizal-relayed chemical defense prime. Reduces
   * herbivory damage while active. Set when a network neighbor is attacked. Issue #3331. */
  defenseTimer?: number
  /** Current metamorphic stage — set at hatch time or after each transition. Issue #3336. */
  lifeStage?: 'larva' | 'pupa' | 'adult' | 'nymph'
  /** Countdown seconds until adult emergence. Only set on pupa-stage creatures. Issue #3336. */
  pupalTimer?: number
  /** Current instar number (1..N) for hemimetabolous nymphs. Issue #3340. */
  instar?: number
  /** Countdown seconds remaining in a moult pause. Set when moulting begins. Issue #3341. */
  moultingTimer?: number
  /** Countdown seconds until this web-spinner places the next web tile. Issue #3420. */
  webBuildTimer?: number
  /** True when this flying creature has been caught in a web tile. Issue #3420. */
  webTrapped?: boolean
  /** Numeric material index this creature is currently carrying. Issue #3412, #3418. */
  carriedMaterial?: number
  /** X tile of this nestBuilder's chosen nest site. Issue #3418. */
  nestX?: number
  /** Y tile of this nestBuilder's chosen nest site. Issue #3418. */
  nestY?: number
  /** Number of tiles delivered to the nest so far. Issue #3418. */
  nestProgress?: number
  /** X tile of this creature's self-dug burrow entrance. Issue #3419. */
  burrowX?: number
  /** Y tile of this creature's self-dug burrow entrance. Issue #3419. */
  burrowY?: number
  /** Food energy reserves cached in the burrow, 0–1 hunger-scale. Issue #3419. */
  cachedFood?: number
  /** True while this creature is underground at its burrow site. Issue #3419. */
  inBurrow?: boolean
  /**
   * WorldState.nestSites key (e.g. "12,34") of the structure this secondary
   * colonizer is currently occupying. Undefined when not in a structure. Issue #3423.
   */
  occupiedStructureKey?: string
  /** Running count of wood tiles placed by a damBuilder creature. Issue #3422. */
  damProgress?: number
  /** X tile of memorized home landmark (set at first tick for landmarkMemory creatures). Issue #3326. */
  homeLandmarkX?: number
  /** Y tile of memorized home landmark (set at first tick for landmarkMemory creatures). Issue #3326. */
  homeLandmarkY?: number
  /** True once a semelparous creature has reproduced; prevents second reproduction. Issue #3259. */
  hasReproduced?: boolean
  /** Active spine-sharing boost from nearby Healthcare pact members. 0 when alone. Issue #3301. */
  spineBoost?: number
}

/**
 * A dead animal's remains — a temporary food source for carnivores.
 *
 * Spawned at death (either eaten by a predator or killed by the world).
 * Plants are excluded: grazers find them alive; a decomposing plant corpse
 * would make root-species too easy to farm.
 */
export interface Carcass {
  id: number
  /** World-tile coordinates of the creature's centre at the moment of death. */
  x: number
  y: number
  /** Seconds until this carcass vanishes. */
  decaySeconds: number
  /** Blueprint of the creature that died — determines who can eat it. */
  blueprintId: string
}

/**
 * A permanent marker left where a named creature died.
 *
 * Unlike carcasses, tombstones never decay — they are a memorial, not a food
 * source. Placed at death for any named creature regardless of species, so a
 * named plant that burns still gets its headstone.
 */
export interface Tombstone {
  id: number
  x: number // world tile x, creature centre at death
  y: number // world tile y, creature centre at death
  name: string // what the player called it
  blueprintId: string
  ageSeconds: number // how long it lived
  generation: number // which generation
  mealsEaten: number
  children: number
}

/** A named creature — may be alive or dead. */
export interface NamedCreatureEntry {
  name: string
  blueprintId: string
  ageSeconds: number
  generation: number
  mealsEaten: number
  children: number
  alive: boolean
}

/**
 * An unhatched egg dropped by an egg-laying creature.
 *
 * Contains the full inherited traits so the juvenile hatches with the same
 * genetics it would have received at live birth. Sits in place and can be
 * eaten by any predator that could eat the parent species.
 */
export interface Egg {
  id: number
  /** World-tile coordinates of the egg's centre. */
  x: number
  y: number
  /** The species this egg will hatch into. */
  blueprintId: string
  /** The inherited traits for the juvenile that hatches from this egg. */
  traits: Traits
  /** Which generation the hatchling will be. */
  generation: number
  /** Seconds until this egg hatches. */
  hatchIn: number
}

/**
 * A dormant seed resting in the soil seed bank. Seeds enter dormancy when a
 * pollinator drops them on unsuitable terrain. They persist until conditions
 * allow germination or viability falls to zero. Issue #3350.
 */
export interface SeedEntry {
  /** Unique id within this world. */
  id: number
  /** The plant species this seed will grow into. */
  blueprintId: string
  /** Tile X position where the seed is buried. */
  x: number
  /** Tile Y position where the seed is buried. */
  y: number
  /** Seconds since this seed entered the seed bank. */
  age: number
  /** Accumulated seconds of cold exposure (seasonFactor < 0.9) for stratification. */
  coldHours?: number
  /** True once lava heat has scarified this seed's coat, enabling germination. Issue #3353. */
  fireScarified?: boolean
}

/**
 * A chemical marker left when a creature eats.
 *
 * Same-species animals that are hungry and have nothing in sight drift toward
 * nearby scents, creating social foraging without any explicit communication.
 * Decays over 15 seconds and vanishes. Capped at 200 world-wide.
 */
export interface Scent {
  x: number
  y: number
  /** Which species left this marker. Only that species follows it. */
  blueprintId: string
  /** Seconds until this marker vanishes. */
  decaySeconds: number
  /** When true, this is a polarized-light mating signal; only detected by polarizedVision creatures */
  polarized?: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

/**
 * A burrow dug by a territorial creature at its home position.
 *
 * Built gradually while the creature rests well-fed. Decays once the owner
 * dies or wanders away and never returns. Multiple creatures of the same
 * species do not share nests — each has its own.
 */
export interface Nest {
  id: number
  /** ID of the creature that owns this nest. */
  creatureId: number
  /** World-tile x coordinate of the burrow entrance. */
  x: number
  /** World-tile y coordinate of the burrow entrance. */
  y: number
  /** Build progress, 0..1. Only complete (1) nests are drawn at full opacity. */
  progress: number
  /** Seconds before this nest collapses. Resets while owner is resting here; counts down when owner is absent. */
  decaySeconds: number
}

/**
 * An in-world object that continuously emits creatures of a chosen species.
 *
 * Placed by the player via the toolbar. Counts down a cooldown each tick and
 * drops one creature when it reaches zero, subject to local and global
 * population caps.
 */
export interface Spawner {
  id: number
  x: number
  y: number
  /** Which species this spawner emits. */
  blueprintId: string
  /** Seconds between emissions. */
  intervalSeconds: number
  /** Seconds remaining until the next emission. Counts down each tick. */
  cooldown: number
  /** Do not emit if this many creatures of the target species are within maxLocal tiles. */
  maxLocal: number
}

/**
 * Per-species world-generator config.
 *
 * Determines which species the ground seeds automatically, how often, and
 * whether it does so at all. Plant generators are enabled by default (they
 * replace the current seedNativePlants batch logic); animal generators are
 * off by default and exist so the player can opt into background seeding.
 */
export interface WorldGeneratorEntry {
  blueprintId: string
  /** Whether the world actively seeds this species on its timer. */
  enabled: boolean
  /** Seconds between seeding attempts. */
  intervalSeconds: number
  /**
   * World-clock time of the next seeding attempt.
   *
   * Runtime only — never saved; resets to 0 on restore so the world starts
   * seeding immediately after a load rather than waiting out a stale timer.
   */
  nextSeed: number
}

/**
 * Whittaker biome classification — one of eight climate zones.
 * Assigned per horizontal region band (8 bands from sky to bedrock).
 * Issue #3377.
 */
export type BiomeZoneType =
  | 'tropical-rainforest'
  | 'tropical-savanna'
  | 'desert'
  | 'temperate-grassland'
  | 'temperate-forest'
  | 'boreal'
  | 'tundra'
  | 'ice-cap'

/** One classified biome band — a full-width horizontal slice of the world. */
export interface BiomeZone {
  /** Region index (0 = top/coldest, NUM_BIOME_REGIONS-1 = bottom/warmest). */
  regionIndex: number
  /** Classified biome type for this band. */
  type: BiomeZoneType
  /** Annual temperature proxy [0, 1]; higher = warmer. Derived from Y position × seasonFactor. */
  temperature: number
  /** Average moisture [0, 1] sampled across region tiles. */
  precipitation: number
}

export interface WorldState {
  width: number
  height: number
  /** Row-major grid of materials, length `width * height`. */
  tiles: Uint8Array
  /** Per-tile color jitter, so the terrain doesn't look flat. */
  grain: Uint8Array
  creatures: Creature[]
  particles: Particle[]
  carcasses: Carcass[]
  tombstones: Tombstone[]
  nextTombstoneId: number
  nextCarcassId: number
  scents: Scent[]
  /**
   * Per-tile moisture level, [0,1]. Tiles near water gain moisture; all tiles
   * slowly dry out. Plants seed more readily in moist soil.
   */
  moisture: Float32Array
  /**
   * Per-tile dissolved organic carbon from surface water drips.
   * 0 in dry caves; up to 1 under active drip points (where surface water
   * percolates through stone). Boosts stone tile fertility for cave bacteria
   * and specialist cave plants. Updated by `tickCaveNutrient`.
   */
  caveNutrient?: Float32Array
  /**
   * Per-tile salinity, 0 (fresh) to 1 (salt water). Initialized from
   * world edges when estuaryEnabled, diffused each tick. Creates a mixing
   * zone (estuary) in the middle of the world.
   */
  salinity?: Float32Array
  /**
   * Dissolved organic carbon exported from decomposing marsh plants.
   * Boosts plant productivity in estuarine tiles. [0, 1] per tile.
   */
  marshDetritus?: Float32Array
  /**
   * X tile position where each invasive species was first observed in this
   * world. Keyed by blueprintId. Populated lazily when the first individual
   * of an invasive species is seen. Issue #3366.
   */
  invasionOriginX?: Record<string, number>
  /**
   * Maximum X tile position ever reached by each invasive species, ratcheting
   * up monotonically. Keyed by blueprintId. Tracks the historical invasion
   * front. Issue #3366.
   */
  invasionFrontX?: Record<string, number>
  /**
   * Per-tile flow velocity zone for river/stream tiles.
   * 0 = non-water or uncomputed, 1 = pool (slow), 2 = run (intermediate), 3 = riffle (fast).
   * Only set on water tiles; all other tiles remain 0. Updated every 60 ticks.
   */
  flowZone?: Uint8Array
  /**
   * Per-tile light level [0, 1]. 1 = full sky exposure, 0 = complete shade.
   * Computed by column-sweep from top to bottom: each solid tile attenuates by 0.25.
   * Updated every 30 ticks. Used for light-gap germination triggers. Issue #3351.
   */
  lightGrid?: Float32Array
  eggs: Egg[]
  nextEggId: number
  /**
   * Seeds that failed to germinate on dispersal and entered soil dormancy.
   * Populated lazily; undefined in worlds with no seed bank activity.
   * Max 300 seeds — oldest are evicted if the cap is reached. Issue #3350.
   */
  seedBank?: SeedEntry[]
  /** Monotonically increasing id for the next SeedEntry. */
  nextSeedBankId?: number
  /** Burrows dug by territorial creatures at their home positions. */
  nests: Nest[]
  nextNestId: number
  /** Blueprints available in this world, keyed by id. */
  blueprints: Record<string, CreatureBlueprint>
  nextCreatureId: number
  /** Seconds since the world started. */
  elapsed: number
  /** Deterministic RNG state. */
  seed: number
  /** Tile-simulation phase, alternated so liquids don't drift one way. */
  flowPhase: number
  /**
   * Species that belong to this world — theme starters plus anything the player
   * summoned. The ground's seed bank only ever draws from this list, so a desert
   * never spontaneously sprouts kelp.
   */
  natives: string[]
  /** Next world-clock time at which the ground may seed native plants. */
  nextPlantSeed: number
  /**
   * True while the player has deliberately emptied the world.
   *
   * Native plants otherwise grow back out of the soil forever, which would make
   * Empty impossible to hold on any world that has ground in it. Anything
   * generative — painting, placing, summoning, changing theme — wakes it again.
   */
  dormant: boolean
  /** Placed spawner objects. Emit one creature of their species on a timer. */
  spawners: Spawner[]
  nextSpawnerId: number
  /** Per-species background-seeding config. Plants default to enabled. */
  generators: WorldGeneratorEntry[]
  /**
   * Whittaker biome zones — one entry per horizontal region band.
   * 8 bands by default (top = coldest/sky, bottom = warmest/deep). Updated
   * by `updateBiomeZones` every 300 ticks. Undefined until first pass.
   * Issue #3377.
   */
  biomeZones?: BiomeZone[]
  /**
   * Atmospheric CO2 concentration offset [0, 1]. 0 = pre-industrial baseline,
   * 1 = extreme warming. Emitted by lava tiles; absorbed by living plants.
   * Raises temperature baseline in `updateBiomeZones`, shifting zones toward
   * warmer classification. Issue #3381.
   */
  atmosphericCO2?: number
  /**
   * Atmospheric O2 level relative to baseline [0, 2]. 1.0 = normal.
   * Plants produce O2; animals and lava consume it. Below 0.7 causes
   * metabolic stress in non-plant creatures. Issues #3275, #3276.
   */
  atmosphericO2?: number
  /**
   * Mycorrhizal network graph: maps creature ID (as string) to array of
   * connected creature IDs. Entries are pruned when a creature dies. Undefined
   * until first mycorrhizal plant establishes. Issue #3329.
   */
  mycorrhizalLinks?: Record<string, number[]>
  /**
   * Active nest sites built by nestBuilder creatures.
   *
   * Keyed as `"x,y"`. Each entry tracks the owner, coordinates and number of
   * tiles delivered. Used for egg hatch bonus and nest rendering. Issues #3412, #3418.
   */
  nestSites?: Record<string, { progress: number; ownerId: number; x: number; y: number }>
  /**
   * ID of the currently-reigning Monarch Kestrel (kestrelKingdom species).
   * Updated each season by the reckoning logic. Cleared when no kestrel survives.
   * Issue #3304.
   */
  kestrelMonarchId?: number
  /**
   * Index of the last season for which the Kestrel Kingdom reckoning ran.
   * Prevents the election from firing on every tick. Issue #3304.
   */
  kestrelLastSeasonIdx?: number
  /** True after the Crab Constitution has been ratified for the first time. Issue #3296. */
  crabConstitutionRatified?: boolean
  /** Next elapsed time for the Duck Town Hall. Issue #3297. */
  duckTownHallTime?: number
}

// ---------------------------------------------------------------------------
// Event history
// ---------------------------------------------------------------------------

export type HistoryEventKind = 'born' | 'died' | 'plant_died' | 'ate' | 'named' | 'plant' | 'sick'

export interface HistoryEntry {
  id: number
  /** Simulation elapsed seconds at the time of the event. */
  simTime: number
  kind: HistoryEventKind
  /** Blueprint id of the primary creature involved. */
  blueprintId: string
  /** Display name of the species. */
  speciesName: string
  /** Name of the individual creature, if it had one. */
  creatureName: string | null
  /** Human-readable one-liner. */
  detail: string
  /** Death cause — only present when kind === 'died'. */
  cause?: 'starved' | 'eaten' | 'drowned' | 'burned' | 'aged' | 'diseased'
  /** Blueprint id of the killer species — only for cause === 'eaten'. */
  killerBlueprintId?: string
  killerSpeciesName?: string
}

/**
 * A minimal snapshot of one living creature, used to render the population
 * viewer circles in the Field Guide sidebar.
 */
export interface CreatureThumb {
  id: number
  blueprintId: string
  ageSeconds: number
  /** Player-given name, or null for unnamed individuals. */
  name: string | null
}
