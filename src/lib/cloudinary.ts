import { v2 as cloudinary, UploadApiResponse } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export interface CloudinaryUploadResult {
  public_id: string
  secure_url: string
  width: number
  height: number
  format: string
  bytes: number
  created_at: string
}

export interface CloudinaryUploadOptions {
  folder: string
  public_id?: string
  overwrite?: boolean
  resource_type?: 'image' | 'video' | 'raw' | 'auto'
  transformation?: Record<string, unknown>
}

/**
 * Upload a base64 image to Cloudinary
 */
export async function uploadBase64Image(
  base64Data: string,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder: options.folder,
      public_id: options.public_id,
      overwrite: options.overwrite ?? false,
      resource_type: options.resource_type ?? 'image',
      transformation: options.transformation,
    })

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      created_at: result.created_at,
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw new Error(`Failed to upload image to Cloudinary: ${error}`)
  }
}

/**
 * Upload an image buffer to Cloudinary
 */
export async function uploadImageBuffer(
  buffer: Buffer,
  options: CloudinaryUploadOptions
): Promise<CloudinaryUploadResult> {
  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: options.folder,
            public_id: options.public_id,
            overwrite: options.overwrite ?? false,
            resource_type: options.resource_type ?? 'image',
            transformation: options.transformation,
          },
          (error, result) => {
            if (error) reject(error)
            else if (result) resolve(result)
            else reject(new Error('No result returned from Cloudinary'))
          }
        )
        .end(buffer)
    })

    return {
      public_id: result.public_id,
      secure_url: result.secure_url,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
      created_at: result.created_at,
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    throw new Error(`Failed to upload image to Cloudinary: ${error}`)
  }
}

/**
 * Delete an image from Cloudinary
 */
export async function deleteImage(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId)
  } catch (error) {
    console.error('Cloudinary delete error:', error)
    throw new Error(`Failed to delete image from Cloudinary: ${error}`)
  }
}

/**
 * Generate a unique public ID for an image
 */
export function generatePublicId(prefix: string, characterName?: string): string {
  const timestamp = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 8)
  const sanitizedName = characterName
    ? characterName.toLowerCase().replace(/[^a-z0-9]/g, '_')
    : 'character'

  return `${prefix}_${sanitizedName}_${timestamp}_${randomSuffix}`
}

export default cloudinary
