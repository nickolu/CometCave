import '@/app/clusters/clusters.css'
import { ClustersGameView } from '@/app/clusters/components/ClustersGameView'
import { getTodayPST } from '@/lib/dates'

/** A puzzle from the archive. The API still refuses future dates. */
export default async function ClustersArchivePage({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  return <ClustersGameView date={date} today={getTodayPST()} />
}
