import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const config = {
  maxDuration: 300, // 5 minutes in seconds
};

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
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();

    const image = formData.get('image');
    const prompt = formData.get('prompt') as string | null;
    const nStr = formData.get('n') as string | null;
    const size = (formData.get('size') as string | null) || '1024x1024';

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ error: 'Missing image file' }, { status: 400 });
    }

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const n = nStr ? Number.parseInt(nStr, 10) : 1;

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Call the Images Edit endpoint.
    const response = await openai.images.edit({
      image,
      prompt,
      model: 'gpt-image-1',
      n,
      size: size as '1024x1024' | '1024x1536' | '1536x1024' | 'auto',
    });

    const images = response.data
      ?.map(item => {
        if ('url' in item && item.url) return item.url as string;
        if ('b64_json' in item && item.b64_json) return `data:image/png;base64,${item.b64_json}`;
        return undefined;
      })
      .filter(Boolean);

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Avatar Maker API error:', error);
    if (error instanceof Error) {
      try {
        const errorJson = JSON.parse(error.message);
        if (errorJson.error.message.includes('Rate limit')) {
          return NextResponse.json({ error: errorJson.error.message }, { status: 500 });
        }
      } catch (e) {
        console.error('Avatar Maker API error:', e);
      }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
