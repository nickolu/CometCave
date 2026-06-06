import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextResponse } from 'next/server'

import { generatePublicId, uploadBase64Image } from '@/lib/cloudinary'
import { isImageGenerationAllowed } from '@/lib/utils'

export const maxDuration = 120

export const runtime = 'nodejs'

// NOTE: This uses Gemini's image generation capability (gemini-2.0-flash-preview-image-generation).
// The @google/generative-ai SDK is used for this. Could be swapped to OpenAI gpt-image-1 if needed.

export async function POST(request: Request) {
  try {
    // Check if image generation is allowed
    if (!isImageGenerationAllowed()) {
      return NextResponse.json({ error: 'Image generation is currently disabled' }, { status: 403 })
    }

    const { prompt, artStyle, storyContext } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Build a detailed illustration prompt
    const artStyleDescriptions: Record<string, string> = {
      cartoon: 'colorful cartoon illustration style, bold outlines, vibrant colors',
      anime: 'anime/manga illustration style, expressive characters, clean linework',
      watercolor: 'soft watercolor illustration style, gentle washes, painterly textures',
      'pixel-art': 'pixel art style, retro 16-bit aesthetic, chunky pixels',
      realistic: 'realistic illustration style, detailed rendering, natural lighting',
    }

    const artStyleDesc = artStyleDescriptions[artStyle] || 'illustration style'

    let imagePrompt = `Create a children's storybook illustration. Art style: ${artStyleDesc}. ${storyContext ? `Story context: ${storyContext}. ` : ''}Scene to illustrate: ${prompt}. Keep it age-appropriate, friendly, and visually engaging.`

    console.log('Storybook illustration generation attempt 1:', imagePrompt)

    // Progressive safety easing — up to 5 attempts with increasingly safe prompts
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Use Gemini for image generation
        // gemini-2.0-flash-preview-image-generation supports IMAGE responseModality
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.0-flash-preview-image-generation',
          // @ts-expect-error generationConfig types don't yet include responseModalities in older type defs
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        })

        const result = await model.generateContent(imagePrompt)
        const response = result.response

        // Extract image data from response parts
        let imageB64: string | null = null
        for (const part of response.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            imageB64 = part.inlineData.data
            break
          }
        }

        if (!imageB64) {
          throw new Error('No image data returned from Gemini')
        }

        const mimeType =
          response.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.mimeType?.startsWith('image/'))
            ?.inlineData?.mimeType ?? 'image/png'

        const imageUrl = `data:${mimeType};base64,${imageB64}`

        // Upload to Cloudinary
        let cloudinaryUrl = imageUrl // fallback to base64 if Cloudinary fails
        let cloudinaryPublicId = ''

        try {
          const publicId = generatePublicId('storybook_illustration', artStyle)
          const cloudinaryResult = await uploadBase64Image(imageUrl, {
            folder: 'storybook-factory',
            public_id: publicId,
            overwrite: true,
          })
          cloudinaryUrl = cloudinaryResult.secure_url
          cloudinaryPublicId = cloudinaryResult.public_id
          console.log(`Successfully uploaded illustration to Cloudinary: ${cloudinaryUrl}`)
        } catch (cloudinaryError) {
          console.error('Failed to upload illustration to Cloudinary:', cloudinaryError)
          // Continue with base64 URL as fallback
        }

        return NextResponse.json({
          imageUrl: cloudinaryUrl,
          prompt: imagePrompt,
          attempt,
          cloudinaryPublicId: cloudinaryPublicId || undefined,
        })
      } catch (error: unknown) {
        console.error(`Storybook illustration generation attempt ${attempt} failed:`, error)

        if (attempt < 5) {
          // Generate a safer prompt for the next attempt
          try {
            const errorMessage = error instanceof Error ? error.message : 'a content policy error'
            const safetyResult = await generateText({
              model: openaiClient('gpt-4o-mini'),
              prompt: `This image generation prompt failed due to ${errorMessage}. Please respond with a new prompt that addresses the concerns of the previous failure, but remains as close to what the user is asking for as possible. The image is for a children's storybook, so keep it age-appropriate and safe.

Original prompt: ${imagePrompt}

New safer prompt:`,
              temperature: 0.5,
              maxTokens: 200,
            })

            imagePrompt = safetyResult.text
            console.log(`Retrying with safer prompt (attempt ${attempt + 1}):`, imagePrompt)
          } catch (safetyError) {
            console.error('Failed to generate safer prompt:', safetyError)
            // Generic fallback prompt
            imagePrompt = `A friendly children's storybook illustration in ${artStyle} style showing a charming scene with colorful characters in a whimsical setting`
          }
        } else {
          // Final fallback after all attempts
          console.log('All illustration generation attempts failed, using placeholder')
          return NextResponse.json({
            imageUrl: '/placeholder.jpg',
            prompt: 'Default fallback image',
            attempt,
            fallback: true,
          })
        }
      }
    }

    // Should not reach here, but TypeScript requires a return
    return NextResponse.json({
      imageUrl: '/placeholder.jpg',
      prompt: 'Default fallback image',
      attempt: 5,
      fallback: true,
    })
  } catch (error) {
    console.error('Error generating illustration:', error)
    return NextResponse.json({ error: 'Failed to generate illustration' }, { status: 500 })
  }
}
