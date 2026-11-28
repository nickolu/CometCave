import PictureTelephoneApp from './PictureTelephoneApp'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Picture Telephone — CometCave',
  description:
    'Describe a picture, draw the next one, and watch a sentence drift as it is passed along. Play with friends or with AI players.',
}

export default function PictureTelephonePage() {
  return <PictureTelephoneApp />
}
