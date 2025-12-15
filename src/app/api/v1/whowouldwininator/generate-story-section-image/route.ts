import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'
import OpenAI from 'openai'

import { generatePublicId, uploadBase64Image } from '@/lib/cloudinary'
import { isImageGenerationAllowed } from '@/lib/utils'

export const config = {
  maxDuration: 300, // 5 minutes in seconds
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    // Check if image generation is allowed
    if (!isImageGenerationAllowed()) {
      return NextResponse.json({ error: 'Image generation is currently disabled' }, { status: 403 })
    }
    const {
      candidate1Name,
      candidate1Description,
      candidate2Name,
      candidate2Description,
      battleScenario,
      contestResults,
      storySection,
      sectionType, // 'intro', 'climax', or 'ending'
    } = await request.json()

    if (!storySection || !sectionType) {
      return NextResponse.json(
        { error: 'Story section and section type are required' },
        { status: 400 }
      )
    }

    const openaiClient = createOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    // Build scenario description for image prompt
    const scenarioDescription = battleScenario.setting || 'open field'

    // Determine winner for image composition
    let winnerName = ''
    if (contestResults.winner === 'candidate1') {
      winnerName = candidate1Name
    } else if (contestResults.winner === 'candidate2') {
      winnerName = candidate2Name
    }

    // Create section-specific image prompt based on the story section
    let imagePrompt = ''
    const baseDescription = `Character 1: ${candidate1Description}. Character 2: ${candidate2Description}. Setting: ${scenarioDescription}.`

    switch (sectionType) {
      case 'intro':
        imagePrompt = `Create an epic cinematic image depicting the introduction of this battle: "${storySection}". ${baseDescription} Focus on the initial confrontation, the tension before the battle begins, and both characters preparing or sizing each other up. The image should capture the anticipation and setup described in the text with dramatic lighting and cinematic composition. Make it visually striking and epic.`
        break
      case 'climax':
        imagePrompt = `Create an epic cinematic image depicting the climactic moment of this battle: "${storySection}". ${baseDescription} Focus on the most intense action, the decisive moment, and the peak of the conflict described in the text. Show dynamic combat, energy effects, and the turning point of the battle. Make it visually striking and epic with maximum drama and action.`
        break
      case 'ending':
        if (contestResults.winner === 'tie') {
          imagePrompt = `Create an epic cinematic image depicting the conclusion of this battle: "${storySection}". ${baseDescription} Focus on the aftermath showing both characters equally matched or exhausted, depicting the tie outcome described in the text. Show the resolution and final state with dramatic lighting and cinematic composition. Make it visually striking and epic.`
        } else {
          imagePrompt = `Create an epic cinematic image depicting the conclusion of this battle: "${storySection}". ${baseDescription} Winner: ${winnerName}. Focus on the final outcome, the aftermath of victory and defeat as described in the text. Show the resolution with the winner triumphant and the defeated opponent. Make it visually striking and epic with dramatic lighting.`
        }
        break
      default:
        imagePrompt = `Create an epic cinematic image depicting this battle scene: "${storySection}". ${baseDescription} Focus on the action and drama described in the text with dynamic composition, energy effects, and cinematic lighting. Make it visually striking and epic.`
    }

    console.log(
      `Story section image generation attempt 1 for ${candidate1Name} vs ${candidate2Name} (${sectionType}):`,
      imagePrompt
    )

    // Progressive safety easing - try up to 5 times with increasingly safe prompts
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Generate the actual image using GPT-Image-1
        const imageResponse = await openai.images.generate({
          model: 'gpt-image-1',
          prompt: imagePrompt,
          n: 1,
          size: '1024x1024',
        })

        const imageB64 = imageResponse.data?.[0]?.b64_json

        if (!imageB64) {
          throw new Error('No image data returned from OpenAI')
        }

        // Convert base64 to data URL for fallback
        const imageUrl = `data:image/png;base64,${imageB64}`

        // Upload to Cloudinary
        let cloudinaryUrl = imageUrl // fallback to base64 if Cloudinary fails
        let cloudinaryPublicId = ''

        try {
          const battleName = `${candidate1Name}_vs_${candidate2Name}_${sectionType}`
          const publicId = generatePublicId('whowouldwininator_story', battleName)
          const cloudinaryResult = await uploadBase64Image(imageUrl, {
            folder: 'whowouldwininator-story-sections',
            public_id: publicId,
            overwrite: true,
          })
          cloudinaryUrl = cloudinaryResult.secure_url
          cloudinaryPublicId = cloudinaryResult.public_id
          console.log(`Successfully uploaded story section image to Cloudinary: ${cloudinaryUrl}`)
        } catch (cloudinaryError) {
          console.error('Failed to upload story section image to Cloudinary:', cloudinaryError)
          // Continue with base64 URL as fallback
        }

        // Generate alt text description
        const altTextResult = await generateText({
          model: openaiClient('gpt-4o-mini'),
          prompt: `Create a detailed alt text description for a contest image showing: ${imagePrompt}

Return a concise but descriptive alt text that would help someone understand what the image shows, focusing on:
- The two characters and their appearance
- The action or scene taking place
- The setting and environment
- The specific moment being depicted (${sectionType} of the battle)
- Key visual elements

Keep it under 200 characters.`,
          temperature: 0.7,
          maxTokens: 100,
        })

        return NextResponse.json({
          imageUrl: cloudinaryUrl,
          altText: altTextResult.text,
          prompt: imagePrompt,
          sectionType,
          attempt: attempt,
          cloudinaryPublicId: cloudinaryPublicId || undefined,
        })
      } catch (error: unknown) {
        console.error(`Story section image generation attempt ${attempt} failed:`, error)

        if (attempt < 3) {
          // Generate a safer prompt for the next attempt
          try {
            const errorMessage = error instanceof Error ? error.message : 'a safety error'
            const safetyResult = await generateText({
              model: openaiClient('gpt-4o-mini'),
              prompt: `This image generation prompt failed due to ${errorMessage}. Please respond with a new prompt that addresses the concerns of the previous failure, but remains as close to what the user is asking for as possible. If the user was asking for a generation of a copyrighted character, for example, try describing that character in vague terms that are not specific to that character, or describing details that allude to the character without saying it outright. e.g. "left webbing behind", "a lean but muscular young man in a tight fitting superhero costume, swinging from a white rope", etc.

Original prompt: ${imagePrompt}

New safer prompt:`,
              temperature: 0.5,
              maxTokens: 200,
            })

            imagePrompt = safetyResult.text
            console.log(`Retrying with safer prompt (attempt ${attempt + 1}):`, imagePrompt)
          } catch (safetyError) {
            console.error('Failed to generate safer prompt:', safetyError)
            // If we can't generate a safer prompt, make a generic one
            imagePrompt = `A generic fantasy battle scene depicting the ${sectionType} of a contest in ${scenarioDescription}, with dramatic lighting and cinematic composition`
          }
        } else {
          // Final fallback after 3 attempts
          console.log('All story section image generation attempts failed, using default image')
          return NextResponse.json({
            imageUrl: '/placeholder.jpg',
            altText: `A ${sectionType} scene between ${candidate1Name} and ${candidate2Name} in ${scenarioDescription}`,
            prompt: 'Default fallback image',
            sectionType,
            attempt: attempt,
            fallback: true,
          })
        }
      }
    }
  } catch (error) {
    console.error('Error generating story section image:', error)
    return NextResponse.json({ error: 'Failed to generate story section image' }, { status: 500 })
  }
}
