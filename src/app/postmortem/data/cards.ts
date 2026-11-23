export type CategoryId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type Category = {
  id: CategoryId
  name: string
}

export type Card = {
  id: string
  nickname: string
  officialName: string
  category: CategoryId
}

export const CATEGORIES: Category[] = [
  { id: 1, name: 'Wrong Logic' },
  { id: 2, name: 'Wrong Picture' },
  { id: 3, name: 'Blind Spot' },
  { id: 4, name: 'Action Failed' },
  { id: 5, name: 'Too Many Hands' },
  { id: 6, name: 'Drift' },
  { id: 7, name: 'Outside Forces' },
]

// CF-0029 is retired in the catalog and has no card.
export const CARDS: Card[] = [
  { id: 'CF-0001', nickname: 'Config Blast Radius', officialName: 'Configuration change affected more than its intended scope', category: 1 },
  { id: 'CF-0002', nickname: 'Bad Release', officialName: 'Software release introduced a production defect', category: 1 },
  { id: 'CF-0003', nickname: 'Surprise Side Effect', officialName: 'Planned change had an unanticipated effect', category: 1 },
  { id: 'CF-0004', nickname: 'Migration Mismatch', officialName: 'Data or schema migration altered data running code still used', category: 1 },
  { id: 'CF-0005', nickname: 'Unexpected Input', officialName: 'Code processed input outside its intended range', category: 1 },
  { id: 'CF-0006', nickname: 'Overflow', officialName: "Value hit a boundary the code or schema couldn't represent", category: 1 },
  { id: 'CF-0007', nickname: 'Deleted While In Use', officialName: 'Cleanup or deletion removed data or resources in use', category: 1 },
  { id: 'CF-0026', nickname: 'Safety Trip', officialName: 'Protective control engaged and its action became the outage', category: 1 },
  { id: 'CF-0039', nickname: 'Stale Runbook', officialName: 'Written procedure was ambiguous or outdated', category: 1 },
  { id: 'CF-0008', nickname: 'Stale Cache', officialName: 'Cached or derived state diverged from its source', category: 2 },
  { id: 'CF-0009', nickname: 'Wrong Replica', officialName: 'Failover promoted a replica with different state', category: 2 },
  { id: 'CF-0010', nickname: 'Lying Health Check', officialName: 'Health signal reported healthy while the component failed', category: 2 },
  { id: 'CF-0037', nickname: 'Miscounted Faults', officialName: 'Separate faults appeared as one, or one as several', category: 2 },
  { id: 'CF-0011', nickname: 'Blind Monitoring', officialName: 'Monitoring reported late or reported normal during failure', category: 3 },
  { id: 'CF-0012', nickname: 'Failed Fix', officialName: 'Rollback, failover or restart left service degraded', category: 4 },
  { id: 'CF-0025', nickname: 'Slow Recovery', officialName: 'Recovery took longer or needed more manual work', category: 4 },
  { id: 'CF-0028', nickname: 'Internal Dependency Down', officialName: 'Internal dependency failed and propagated', category: 4 },
  { id: 'CF-0030', nickname: 'Network Loss', officialName: 'Network path lost connectivity or capacity', category: 4 },
  { id: 'CF-0031', nickname: 'DNS Failure', officialName: 'Name resolution returned wrong or no answers', category: 4 },
  { id: 'CF-0032', nickname: 'Auth Down', officialName: 'Authentication or identity service failed', category: 4 },
  { id: 'CF-0035', nickname: 'Hardware Failure', officialName: 'Host, disk or other hardware failed', category: 4 },
  { id: 'CF-0013', nickname: 'Dueling Automation', officialName: 'Automated processes conflicted on shared state', category: 5 },
  { id: 'CF-0014', nickname: 'Hot Node', officialName: 'Scheduling concentrated load on one node or partition', category: 5 },
  { id: 'CF-0015', nickname: 'Over Capacity', officialName: 'Demand exceeded provisioned capacity', category: 6 },
  { id: 'CF-0016', nickname: 'Queue Lockup', officialName: 'Requests queued on a shared resource until it served none', category: 6 },
  { id: 'CF-0017', nickname: 'Out of Memory', officialName: 'Hosts exhausted memory', category: 6 },
  { id: 'CF-0018', nickname: 'Runaway Query', officialName: 'Expensive or runaway queries saturated a data store', category: 6 },
  { id: 'CF-0019', nickname: 'Limit Hit', officialName: 'A provisioned limit was reached', category: 6 },
  { id: 'CF-0020', nickname: 'Outgrown', officialName: 'Demand grew faster than new capacity', category: 6 },
  { id: 'CF-0021', nickname: 'Retry Storm', officialName: 'Retries multiplied load on a recovering service', category: 6 },
  { id: 'CF-0022', nickname: 'Cold Cache', officialName: 'Cache miss or cold cache sent full load to the backing store', category: 6 },
  { id: 'CF-0023', nickname: 'Noisy Batch Job', officialName: 'Bulk or background job competed with serving traffic', category: 6 },
  { id: 'CF-0024', nickname: 'Lingering Backlog', officialName: 'Backlog kept service degraded after the trigger cleared', category: 6 },
  { id: 'CF-0027', nickname: 'Expired Credential', officialName: 'Credential or certificate expired while in use', category: 6 },
  { id: 'CF-0033', nickname: 'Provider Outage', officialName: 'External provider became unavailable or degraded', category: 7 },
  { id: 'CF-0034', nickname: 'Facility Failure', officialName: 'Facility lost power or cooling, or was physically damaged', category: 7 },
  { id: 'CF-0036', nickname: 'External Restriction', officialName: 'External authority or policy restricted the service', category: 7 },
  { id: 'CF-0038', nickname: 'Intruder', officialName: 'Adversary gained access and acted on the system', category: 7 },
]

export const CARDS_BY_ID: Record<string, Card> = Object.fromEntries(CARDS.map(c => [c.id, c]))
