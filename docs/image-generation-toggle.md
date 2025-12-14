# Image Generation Toggle Feature

This document describes the `ALLOW_IMAGE_GENERATION` environment variable feature that allows you to enable or disable image generation functionality across the application.

## Overview

The `ALLOW_IMAGE_GENERATION` environment variable controls whether image generation features are available in the application. When set to `"true"`, all image generation features work normally. When set to any other value or not set at all, image generation features are disabled.

## Affected Features

### Whowouldwininator (`/whowouldwininator`)

- **Character Portraits**: Generation buttons are hidden, existing portraits are not displayed
- **Battle Story Images**: Story section images (intro, climax, ending) are not generated or displayed
- **Story Generation Button**: Changes from "Generate Story & Images" to "Generate Story"

### Avatar Maker (`/avatar-maker`)

- **Avatar Generation**: The entire generation interface is hidden
- **Disabled State**: Shows a message indicating image generation is disabled

## Implementation Details

### Environment Variable

```env
ALLOW_IMAGE_GENERATION=true   # Enables image generation
ALLOW_IMAGE_GENERATION=false  # Disables image generation (default)
```

### API Endpoints

The following API endpoints check the environment variable and return a 403 error if image generation is disabled:

- `POST /api/v1/whowouldwininator/generate-character-details/portrait`
- `POST /api/v1/whowouldwininator/generate-contest-results-image`
- `POST /api/v1/whowouldwininator/generate-story-section-image`
- `POST /api/v1/avatar-maker/edit`

### Client-Side Status Check

A new endpoint provides the image generation status to client components:

- `GET /api/v1/image-generation-status` - Returns `{ allowed: boolean }`

### Utility Functions

Two utility functions are available:

```typescript
// Server-side (API routes)
import { isImageGenerationAllowed } from '@/lib/utils'
const allowed = isImageGenerationAllowed()

// Client-side (React components)
import { isImageGenerationAllowedClient } from '@/lib/utils'
const allowed = await isImageGenerationAllowedClient()
```

## Usage

### Development

```bash
# Enable image generation
ALLOW_IMAGE_GENERATION=true npm run dev

# Disable image generation with custom message
ALLOW_IMAGE_GENERATION=false DISABLE_IMAGE_GENERATION_REASON="Feature temporarily unavailable for maintenance" npm run dev

# Disable image generation (default)
npm run dev
```

### Production

Set the environment variable in your deployment environment:

```bash
# Vercel
vercel env add ALLOW_IMAGE_GENERATION
vercel env add DISABLE_IMAGE_GENERATION_REASON

# Docker
docker run -e ALLOW_IMAGE_GENERATION=true -e DISABLE_IMAGE_GENERATION_REASON="Custom message" ...

# Heroku
heroku config:set ALLOW_IMAGE_GENERATION=true
heroku config:set DISABLE_IMAGE_GENERATION_REASON="Custom message"
```

## Behavior When Disabled

### API Endpoints

- Return HTTP 403 with error message: "Image generation is currently disabled"

### UI Components

- **Whowouldwininator**: Portrait generation buttons are hidden, story images are not generated/displayed
- **Avatar Maker**: Shows disabled state with informational message
- **Button Text**: Changes to reflect text-only generation (e.g., "Generate Story" instead of "Generate Story & Images")

## Benefits

1. **Cost Control**: Disable expensive image generation API calls when needed
2. **Feature Toggling**: Easily enable/disable image features for different environments
3. **Graceful Degradation**: Application continues to work without images
4. **Administrative Control**: Administrators can control feature availability

## Testing

To test the feature:

1. **Enabled State**: Set `ALLOW_IMAGE_GENERATION=true` and verify all image generation features work
2. **Disabled State**: Remove the environment variable or set it to `false` and verify:
   - Portrait generation buttons are hidden
   - Story images are not generated
   - Avatar maker shows disabled state
   - API endpoints return 403 errors

## New in This Update

### Custom Disable Messages

- Added `DISABLE_IMAGE_GENERATION_REASON` environment variable for custom disable messages
- Both whowouldwininator and avatar-maker now show blue info alerts with the custom message
- If the env variable is not set, a default message is used

### Visual Improvements

- Added informative blue alerts to both applications when image generation is disabled
- Alerts include an info icon and clear messaging about why the feature is unavailable
