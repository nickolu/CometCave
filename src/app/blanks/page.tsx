import './blanks.css'
import BlanksApp from './BlanksApp'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blanks — CometCave',
  description:
    'Pick a topic, fill in the blanks without seeing the story, then read what you accidentally wrote.',
}

export default function BlanksPage() {
  return <BlanksApp />
}
