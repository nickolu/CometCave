import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'
import OpenAI from 'openai'

import { requireSignedIn, spendForClaims } from '@/lib/api/ai-gate'
import { getImageGenerationDisableReason, isImageGenerationAllowed } from '@/lib/utils'

import { IMAGE_COMPRESSION, IMAGE_FORMAT, IMAGE_QUALITY, IMAGE_SIZE, TEXT_MODEL } from '../safety/config'
import { openAiModeration } from '../safety/moderate'
import { checkAndIncrementModerateLimit } from '../safety/rate-limit'

import { ContentPolicyError, type Deps } from './handlers'

/** The production wiring. Built per request so a missing key is a clean failure, not an import-time crash. */
export function realDeps(): Deps {
  return {
    env: process.env,
    async requireSignedIn(request) {
      const gate = await requireSignedIn(request)
      return gate
    },
    async spend(claims, feature) {
      const res = await spendForClaims(claims, feature)
      return 'error' in res ? res : null
    },
    moderation: openAiModeration(),
    imageGenerationAllowed: isImageGenerationAllowed,
    imageDisableReason: getImageGenerationDisableReason,
    async generateImage(prompt, model) {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      try {
        const res = await openai.images.generate({
          model,
          prompt,
          n: 1,
          size: IMAGE_SIZE,
          quality: IMAGE_QUALITY,
          output_format: IMAGE_FORMAT,
          output_compression: IMAGE_COMPRESSION,
          moderation: 'auto',
        })
        const b64 = res.data?.[0]?.b64_json
        if (!b64) throw new Error('no image returned')
        return b64
      } catch (err) {
        const e = err as { status?: number; code?: string } | null
        if (e?.status === 400 && (e.code === 'moderation_blocked' || e.code === 'content_policy_violation')) {
          throw new ContentPolicyError()
        }
        throw err
      }
    },
    async completeText({ system, user, image, maxTokens, temperature }) {
      const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const { text } = await generateText({
        model: anthropic(TEXT_MODEL),
        system,
        messages: [
          {
            role: 'user',
            content: image
              ? [
                  { type: 'text', text: user },
                  { type: 'image', image: image.base64, mimeType: image.mime },
                ]
              : user,
          },
        ],
        maxTokens,
        temperature,
      })
      return text
    },
    checkModerateLimit: checkAndIncrementModerateLimit,
    random: Math.random,
  }
}
