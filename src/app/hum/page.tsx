import './hum.css'
import HumApp from './HumApp'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hum — CometCave',
  description:
    'Start from a flat line, shape it into sound one knob at a time, and build a beat from it.',
}

export default function HumPage() {
  return <HumApp />
}
