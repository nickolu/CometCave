import { NextResponse } from 'next/server'
import OpenAI from 'openai'

import { generatePublicId, uploadBase64Image } from '@/lib/cloudinary'
import { isImageGenerationAllowed } from '@/lib/utils'

export const config = {
  maxDuration: 300, // 5 minutes in seconds
}

// This route handles avatar editing by calling OpenAI's Images Edit endpoint.
// It expects a multipart/form-data POST request containing:
//   - image: the base image file to edit
//   - prompt: the instruction prompt to apply to the image
//   - (optional) n: number of images to generate (defaults to 1)
//   - (optional) size: image size like "512x512" (defaults to 512x512)
//
// It returns a JSON response with the array of generated image URLs in `urls`.
//
// NOTE: This runs in the Node.js runtime because the OpenAI SDK needs full
// Node APIs when sending File/Blob objects.
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    // Check if image generation is allowed
    if (!isImageGenerationAllowed()) {
      return NextResponse.json({ error: 'Image generation is currently disabled' }, { status: 403 })
    }
    const formData = await req.formData()

    const image = formData.get('image')
    const prompt = formData.get('prompt') as string | null
    const size = (formData.get('size') as string | null) || '1024x1024'

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    // Call the Images Edit endpoint.
    const response = await openai.images.edit({
      image,
      prompt,
      model: 'gpt-image-1',
      n: 1,
      size: size as '1024x1024' | '1024x1536' | '1536x1024' | 'auto',
    })

    const images = response.data
      ?.map(item => {
        if ('url' in item && item.url) return item.url as string
        if ('b64_json' in item && item.b64_json) return `data:image/png;base64,${item.b64_json}`
        return undefined
      })
      .filter(Boolean)

    // Upload images to Cloudinary
    const uploadedImages = await Promise.all(
      (images || []).map(async (imageUrl, index) => {
        if (!imageUrl) return null

        // Only upload base64 images (not external URLs)
        if (imageUrl.startsWith('data:image/')) {
          try {
            const publicId = generatePublicId('avatar_maker', `edit_${Date.now()}_${index}`)
            const cloudinaryResult = await uploadBase64Image(imageUrl, {
              folder: 'avatar-maker',
              public_id: publicId,
              overwrite: true,
            })
            console.log(
              `Successfully uploaded avatar to Cloudinary: ${cloudinaryResult.secure_url}`
            )
            return {
              originalUrl: imageUrl,
              cloudinaryUrl: cloudinaryResult.secure_url,
              cloudinaryPublicId: cloudinaryResult.public_id,
            }
          } catch (cloudinaryError) {
            console.error('Failed to upload avatar to Cloudinary:', cloudinaryError)
            return {
              originalUrl: imageUrl,
              cloudinaryUrl: imageUrl, // fallback to original
              cloudinaryPublicId: undefined,
            }
          }
        } else {
          // For external URLs, just return as-is
          return {
            originalUrl: imageUrl,
            cloudinaryUrl: imageUrl,
            cloudinaryPublicId: undefined,
          }
        }
      })
    )

    return NextResponse.json({
      images: uploadedImages.map(img => img?.cloudinaryUrl).filter(Boolean),
      uploadDetails: uploadedImages.filter(Boolean),
    })
  } catch (error) {
    console.error('Avatar Maker API error:', error)
    if (error instanceof Error) {
      try {
        const errorJson = JSON.parse(error.message)
        if (errorJson.error.message.includes('Rate limit')) {
          return NextResponse.json({ error: errorJson.error.message }, { status: 500 })
        }
      } catch (e) {
        console.error('Avatar Maker API error:', e)
      }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
