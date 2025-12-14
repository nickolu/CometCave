# Cloudinary Integration for Whowouldwininator

This document describes the Cloudinary integration added to the whowouldwininator feature for saving generated images.

## Overview

The following apps now automatically upload all generated images to Cloudinary for persistent storage:

### Whowouldwininator

- **Character portraits**: Uploaded to the `whowouldwininator-portraits` folder
- **Battle scenes**: Uploaded to the `whowouldwininator-battle-scenes` folder

### Avatar Maker

- **Edited avatars**: Uploaded to the `avatar-maker` folder

## Environment Variables

The following environment variables need to be configured:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Implementation Details

### Files Modified

1. **`src/lib/cloudinary.ts`** - New Cloudinary service module
2. **`src/app/api/v1/whowouldwininator/generate-character-details/portrait/route.ts`** - Character portrait generation
3. **`src/app/api/v1/whowouldwininator/generate-contest-results-image/route.ts`** - Battle scene generation
4. **`src/app/api/v1/whowouldwininator/types.ts`** - Updated TypeScript types
5. **`src/app/api/v1/avatar-maker/edit/route.ts`** - Avatar editing and generation

### Key Features

- **Automatic Upload**: Images are automatically uploaded to Cloudinary after generation
- **Fallback Strategy**: If Cloudinary upload fails, the system falls back to base64 data URLs
- **Unique Naming**: Each image gets a unique public ID with timestamp and character/battle info
- **Folder Organization**: Images are organized into appropriate folders for easy management
- **Error Handling**: Comprehensive error handling with logging

### API Response Changes

#### Whowouldwininator APIs

The whowouldwininator API responses now include an optional `cloudinaryPublicId` field:

```typescript
{
  imageUrl: string;           // Cloudinary URL (or base64 fallback)
  altText: string;           // Alt text description
  prompt: string;            // Generation prompt
  cloudinaryPublicId?: string; // Cloudinary public ID (if upload succeeded)
}
```

#### Avatar Maker API

The avatar maker API now returns additional upload details:

```typescript
{
  images: string[];           // Array of Cloudinary URLs (or base64 fallbacks)
  uploadDetails: Array<{
    originalUrl: string;      // Original image URL
    cloudinaryUrl: string;    // Cloudinary URL (or fallback)
    cloudinaryPublicId?: string; // Cloudinary public ID (if upload succeeded)
  }>;
}
```

### Folder Structure

- **`whowouldwininator-portraits/`**: Character portrait images
  - Format: `whowouldwininator_portrait_{character_name}_{timestamp}_{random}`
- **`whowouldwininator-battle-scenes/`**: Battle scene images
  - Format: `whowouldwininator_battle_{char1_vs_char2}_{timestamp}_{random}`
- **`avatar-maker/`**: Avatar editing results
  - Format: `avatar_maker_edit_{timestamp}_{index}_{random}`

## Testing

A test endpoint is available at `/api/v1/whowouldwininator/test-cloudinary` to verify the integration works correctly.

## Benefits

1. **Persistent Storage**: Images are stored permanently and can be accessed via CDN
2. **Performance**: Cloudinary's CDN provides fast image delivery
3. **Scalability**: No need to store images on the server filesystem
4. **Image Optimization**: Cloudinary can automatically optimize images
5. **Backup**: Images are safely stored in the cloud

## Error Handling

The system gracefully handles Cloudinary failures:

- If upload fails, the original base64 image is returned
- Error details are logged for debugging
- The user experience is not disrupted

## Future Enhancements

Potential future improvements:

- Image transformations (resize, crop, etc.)
- Automatic image optimization
- Batch upload capabilities
- Image deletion when characters/battles are removed
