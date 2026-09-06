import { ClustersStats } from '@/app/clusters/components/ClustersStats'
import { getTodayPST } from '@/lib/dates'

export default function ClustersStatsPage() {
  return <ClustersStats today={getTodayPST()} />
}
