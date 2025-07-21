import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Checks if image generation is allowed based on the ALLOW_IMAGE_GENERATION environment variable
 * @returns true if image generation is allowed, false otherwise
 */
export function isImageGenerationAllowed(): boolean {
  return process.env.ALLOW_IMAGE_GENERATION === 'true';
}

/**
 * Gets the reason why image generation is disabled
 * @returns string with the disable reason or a default message
 */
export function getImageGenerationDisableReason(): string {
  return process.env.DISABLE_IMAGE_GENERATION_REASON || 'Image generation is currently disabled. Please contact your administrator to enable this feature.';
}

/**
 * Checks if image generation is allowed on the client side
 * This should be used in React components
 * @returns Promise<boolean> true if image generation is allowed, false otherwise
 */
export async function isImageGenerationAllowedClient(): Promise<boolean> {
  try {
    const response = await fetch('/api/v1/image-generation-status');
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data.allowed === true;
  } catch {
    return false;
  }
}

/**
 * Gets the image generation disable reason on the client side
 * @returns Promise<string> with the disable reason or a default message
 */
export async function getImageGenerationDisableReasonClient(): Promise<string> {
  try {
    const response = await fetch('/api/v1/image-generation-status');
    if (!response.ok) {
      return 'Image generation is currently disabled. Please contact your administrator to enable this feature.';
    }
    const data = await response.json();
    return data.disableReason || 'Image generation is currently disabled. Please contact your administrator to enable this feature.';
  } catch {
    return 'Image generation is currently disabled. Please contact your administrator to enable this feature.';
  }
}
