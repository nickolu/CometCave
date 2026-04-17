import { OpenAI } from 'openai'

import { FALLBACK_SKILL_TREES } from '@/app/tap-tap-adventure/config/fallbackSkillTrees'
import { ClassSkillTree, SkillTreeNode } from '@/app/tap-tap-adventure/models/classSkillTree'
import { getStyleCategory } from '@/app/tap-tap-adventure/lib/classGenerator'

/**
 * Effect templates keyed by style category for programmatic node mechanics.
 * Each entry provides [target, type, value] tuples appropriate to the style.
 *
 * NOTE: Prerequisites must always reference nodes of a lower tier to prevent cycles.
 * The tier-ascending iteration in computeUnlockedTreeSkillIds enforces this.
 */
type NodeEffectTemplate = {
  target: string
  type: 'stat_bonus' | 'percentage_bonus' | 'flat_bonus' | 'special'
  value: number
}

const STYLE_NODE_EFFECTS: Record<string, NodeEffectTemplate[][]> = {
  // index 0-1: tier 1, 2-4: tier 2, 5-7: tier 3, 8: tier 4
  martial: [
    [{ target: 'maxHp', type: 'flat_bonus', value: 15 }],
    [{ target: 'attack', type: 'flat_bonus', value: 3 }],
    [{ target: 'maxHp', type: 'percentage_bonus', value: 10 }],
    [{ target: 'attack', type: 'flat_bonus', value: 5 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 8 }],
    [{ target: 'maxHp', type: 'percentage_bonus', value: 15 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 12 }],
    [{ target: 'all_stats', type: 'stat_bonus', value: 2 }],
    [{ target: 'all_stats', type: 'percentage_bonus', value: 10 }],
  ],
  arcane: [
    [{ target: 'maxMana', type: 'flat_bonus', value: 20 }],
    [{ target: 'attack', type: 'flat_bonus', value: 2 }],
    [{ target: 'maxMana', type: 'percentage_bonus', value: 20 }],
    [{ target: 'mana_regen', type: 'flat_bonus', value: 2 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 10 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 15 }],
    [{ target: 'maxMana', type: 'percentage_bonus', value: 25 }],
    [{ target: 'all_stats', type: 'stat_bonus', value: 2 }],
    [{ target: 'maxMana', type: 'percentage_bonus', value: 30 }],
  ],
  divine: [
    [{ target: 'heal_rate', type: 'flat_bonus', value: 2 }],
    [{ target: 'maxHp', type: 'flat_bonus', value: 12 }],
    [{ target: 'heal_rate', type: 'percentage_bonus', value: 15 }],
    [{ target: 'maxHp', type: 'percentage_bonus', value: 12 }],
    [{ target: 'attack', type: 'flat_bonus', value: 3 }],
    [{ target: 'heal_rate', type: 'percentage_bonus', value: 20 }],
    [{ target: 'maxHp', type: 'percentage_bonus', value: 15 }],
    [{ target: 'all_stats', type: 'stat_bonus', value: 2 }],
    [{ target: 'all_stats', type: 'percentage_bonus', value: 10 }],
  ],
  primal: [
    [{ target: 'attack', type: 'flat_bonus', value: 3 }],
    [{ target: 'heal_rate', type: 'flat_bonus', value: 2 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 10 }],
    [{ target: 'loot_chance', type: 'percentage_bonus', value: 10 }],
    [{ target: 'maxHp', type: 'flat_bonus', value: 15 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 15 }],
    [{ target: 'maxHp', type: 'percentage_bonus', value: 12 }],
    [{ target: 'all_stats', type: 'stat_bonus', value: 2 }],
    [{ target: 'loot_chance', type: 'percentage_bonus', value: 20 }],
  ],
  shadow: [
    [{ target: 'luck', type: 'flat_bonus', value: 2 }],
    [{ target: 'flee_chance', type: 'flat_bonus', value: 10 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 10 }],
    [{ target: 'gold_bonus', type: 'percentage_bonus', value: 15 }],
    [{ target: 'luck', type: 'flat_bonus', value: 3 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 15 }],
    [{ target: 'flee_chance', type: 'percentage_bonus', value: 20 }],
    [{ target: 'luck', type: 'flat_bonus', value: 4 }],
    [{ target: 'all_stats', type: 'stat_bonus', value: 3 }],
  ],
  psionic: [
    [{ target: 'maxMana', type: 'flat_bonus', value: 15 }],
    [{ target: 'luck', type: 'flat_bonus', value: 2 }],
    [{ target: 'maxMana', type: 'percentage_bonus', value: 15 }],
    [{ target: 'attack', type: 'flat_bonus', value: 3 }],
    [{ target: 'luck', type: 'flat_bonus', value: 3 }],
    [{ target: 'attack', type: 'percentage_bonus', value: 12 }],
    [{ target: 'maxMana', type: 'percentage_bonus', value: 20 }],
    [{ target: 'all_stats', type: 'stat_bonus', value: 2 }],
    [{ target: 'all_stats', type: 'percentage_bonus', value: 10 }],
  ],
}

/**
 * Build the 9 node mechanics for a given style category.
 * Returns nodes with IDs and effects but placeholder names/descriptions/icons.
 */
function buildMechanicalNodes(classId: string, style: string): SkillTreeNode[] {
  const category = getStyleCategory(style)
  const templates = STYLE_NODE_EFFECTS[category] ?? STYLE_NODE_EFFECTS.martial
  const t = (i: number) => templates[i][0]

  const t1a = `${classId}_t1_0`
  const t1b = `${classId}_t1_1`
  const t2a = `${classId}_t2_0`
  const t2b = `${classId}_t2_1`
  const t2c = `${classId}_t2_2`
  const t3a = `${classId}_t3_0`
  const t3b = `${classId}_t3_1`
  const t3c = `${classId}_t3_2`
  const t4  = `${classId}_t4_0`

  return [
    { id: t1a, name: '', description: '', icon: '', tier: 1, prerequisiteIds: [], effect: t(0), requiredLevel: 2 },
    { id: t1b, name: '', description: '', icon: '', tier: 1, prerequisiteIds: [], effect: t(1), requiredLevel: 2 },
    { id: t2a, name: '', description: '', icon: '', tier: 2, prerequisiteIds: [t1a], effect: t(2), requiredLevel: 5 },
    { id: t2b, name: '', description: '', icon: '', tier: 2, prerequisiteIds: [t1b], effect: t(3), requiredLevel: 5 },
    { id: t2c, name: '', description: '', icon: '', tier: 2, prerequisiteIds: [t1a], effect: t(4), requiredLevel: 5 },
    { id: t3a, name: '', description: '', icon: '', tier: 3, prerequisiteIds: [t2a], effect: t(5), requiredLevel: 8 },
    { id: t3b, name: '', description: '', icon: '', tier: 3, prerequisiteIds: [t2b], effect: t(6), requiredLevel: 8 },
    { id: t3c, name: '', description: '', icon: '', tier: 3, prerequisiteIds: [t2c], effect: t(7), requiredLevel: 8 },
    { id: t4,  name: '', description: '', icon: '', tier: 4, prerequisiteIds: [t3a, t3b, t3c], effect: t(8), requiredLevel: 12 },
  ]
}

function describeEffect(node: SkillTreeNode): string {
  const e = node.effect
  switch (e.type) {
    case 'flat_bonus':
      return `+${e.value} ${e.target}`
    case 'percentage_bonus':
      return `+${e.value}% ${e.target}`
    case 'stat_bonus':
      return `+${e.value} to all stats`
    case 'special':
      return `special: ${e.target} +${e.value}`
    default:
      return `${e.type} ${e.target} +${e.value}`
  }
}

const skillTreeNamingTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'return_skill_tree',
    description: 'Return creative names, descriptions, and icons for 9 skill tree nodes',
    parameters: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:          { type: 'string', description: 'The node ID as given in the prompt' },
              name:        { type: 'string', description: 'Creative skill name, 2-4 words' },
              description: { type: 'string', description: '1-2 sentence flavor description matching the effect' },
              icon:        { type: 'string', description: 'A single relevant emoji' },
            },
            required: ['id', 'name', 'description', 'icon'],
          },
          minItems: 9,
          maxItems: 9,
        },
      },
      required: ['nodes'],
    },
  },
}

/**
 * Generate a class-specific skill tree with LLM-created names/descriptions.
 * Falls back to static trees on any error.
 *
 * NOTE: Prerequisites always point to lower-tier nodes, preventing cycles.
 */
export async function generateClassSkillTree(
  classId: string,
  className: string,
  combatStyle: string,
): Promise<ClassSkillTree> {
  try {
    const openai = new OpenAI()
    const nodes = buildMechanicalNodes(classId, combatStyle)

    const nodeDescriptions = nodes.map(n =>
      `Node ${n.id} (Tier ${n.tier}, level ${n.requiredLevel}): effect = ${describeEffect(n)}${n.prerequisiteIds.length ? `, requires: ${n.prerequisiteIds.join(', ')}` : ''}`
    ).join('\n')

    const prompt = `You are naming skill tree nodes for a ${className} class with combat style "${combatStyle}".
Create a thematic skill tree with 9 nodes across 4 tiers. The mechanics are already decided — your job is to give each node a creative name, a 1-2 sentence description that matches the effect, and a relevant emoji icon.

Nodes:
${nodeDescriptions}

Do NOT invent new mechanics. Each description must reflect the actual effect listed.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      tools: [skillTreeNamingTool],
      tool_choice: { type: 'function', function: { name: 'return_skill_tree' } },
      temperature: 1.0,
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall?.function?.arguments) {
      throw new Error('No function call in LLM response')
    }

    const parsed = JSON.parse(toolCall.function.arguments) as {
      nodes: { id: string; name: string; description: string; icon: string }[]
    }

    // Merge LLM names/descriptions/icons with mechanical data
    const namedNodes: SkillTreeNode[] = nodes.map(node => {
      const llmNode = parsed.nodes.find(n => n.id === node.id)
      return {
        ...node,
        name: llmNode?.name ?? `${className} Skill`,
        description: llmNode?.description ?? describeEffect(node),
        icon: llmNode?.icon ?? '⭐',
      }
    })

    return {
      classId,
      className,
      nodes: namedNodes,
    }
  } catch {
    return generateFallbackSkillTree(classId, className, combatStyle)
  }
}

/**
 * Return a fallback skill tree for the given class.
 * Uses pre-built static trees for the 4 base classes; for LLM-generated classes,
 * synthesizes a generic tree using style-appropriate effects.
 */
export function generateFallbackSkillTree(
  classId: string,
  className: string,
  combatStyle: string,
): ClassSkillTree {
  // Use pre-built tree if available
  const staticTree = FALLBACK_SKILL_TREES[classId]
  if (staticTree) return staticTree

  // Generic fallback for LLM-generated classes
  const nodes = buildMechanicalNodes(classId, combatStyle)
  const tierLabels = ['I', 'II', 'III', 'IV']
  const tierCounters: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }

  const namedNodes: SkillTreeNode[] = nodes.map(node => {
    const counter = tierCounters[node.tier]++
    return {
      ...node,
      name: `${combatStyle.charAt(0).toUpperCase() + combatStyle.slice(1)} Mastery ${tierLabels[node.tier - 1]}${counter > 0 ? ' ' + (counter + 1) : ''}`,
      description: `A ${combatStyle} technique that grants ${describeEffect(node)}.`,
      icon: '⭐',
    }
  })

  return { classId, className, nodes: namedNodes }
}
