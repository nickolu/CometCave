export interface StoryPanel {
  type: 'illustration' | 'text' | 'speech-bubble' | 'narration-box' | 'sound-effect'
  content: string // For text/speech/narration: the text. For illustration: the image generation prompt.
  character?: string // For speech bubbles: who is speaking
  position: {
    x: number // 0-100 relative percentage
    y: number
    width: number
    height: number
  }
}

export interface StoryPage {
  pageNumber: number
  layout: 'full-image' | 'image-left-text-right' | 'text-over-image' | 'comic-grid' | 'split'
  panels: StoryPanel[]
  backgroundColor?: string
}

export interface StoryLayout {
  title: string
  type: 'comic' | 'storybook' | 'fairy-tale' | 'adventure'
  pages: StoryPage[]
}

export interface GeneratedStory {
  layout: StoryLayout
  generatedAt: string // ISO timestamp
}
