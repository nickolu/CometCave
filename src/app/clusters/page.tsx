import { ClustersGameView } from '@/app/clusters/components/ClustersGameView'
import { getTodayPST } from '@/lib/dates'

import './clusters.css'

// Today is resolved on the server so the board, the streak and the
// one-play-per-day rule all agree on when "today" is.
export default function ClustersPage() {
  return <ClustersGameView today={getTodayPST()} />
}
