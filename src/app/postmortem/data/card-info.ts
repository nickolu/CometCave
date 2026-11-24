import { CARDS_BY_ID } from '@/app/postmortem/data/cards'

import type { CategoryId } from '@/app/postmortem/data/cards'

/**
 * Study notes for each card, written for this game in our own words.
 *
 * Licensing: the Revelara catalog is "All rights reserved" and has no reuse
 * license, so nothing here is copied from it (no definitions, no incident
 * quotes). We paraphrase, keep the boundaries between entries accurate, and
 * link every card to its catalog entry as the source.
 */

export const CATALOG_URL = 'https://revelara.ai/blog/causal-factor-enumeration/'

/** Deep link to one catalog entry. The anchor is the lowercase card ID, e.g. #cf-0026. */
export function catalogUrl(cardId: string): string {
  return `${CATALOG_URL}#${cardId.toLowerCase()}`
}

/** What each category means, in plain words. */
export const CATEGORY_MEANINGS: Record<CategoryId, string> = {
  1: 'The rule or decision the system followed was wrong for the situation it met.',
  2: "The system's picture of what was going on did not match reality.",
  3: 'The problem could not be seen in time to act on it.',
  4: 'Something was asked to happen and did not, or a piece of infrastructure failed.',
  5: 'More than one controller acted on the same thing at the same time.',
  6: 'Conditions moved outside what the system was built and tuned to handle.',
  7: 'Something outside the organization acted on the system, and the organization could not control it.',
}

export type ConfusedWith = {
  id: string
  /** One line on how to tell the two cards apart. */
  howToTell: string
}

export type CardInfo = {
  id: string
  /** 2-3 sentences. */
  meaning: string
  situations: string[]
  clues: string[]
  confusedWith: ConfusedWith[]
  catalogUrl: string
}

type RawInfo = Omit<CardInfo, 'catalogUrl'>

const RAW: RawInfo[] = [
  {
    id: 'CF-0001',
    meaning:
      'A setting change took effect on more than it was meant to reach, or had effects nobody modeled. Settings here include config values, routing rules and feature flags. The change looked right when checked against its intended target.',
    situations: [
      'A flag meant for one region is switched on everywhere.',
      'A rule with a blank field matches every customer.',
      'A value tuned for one service is applied fleet-wide.',
    ],
    clues: [
      'Trouble starts when a setting changes, with no release.',
      'Impact is far wider than the group the change was for.',
      'Reverting the setting is the obvious next move.',
    ],
    confusedWith: [
      { id: 'CF-0002', howToTell: 'Bad Release means new code was faulty. Here no code shipped; a setting did.' },
      {
        id: 'CF-0003',
        howToTell: 'Surprise Side Effect: the change hit only its target and still surprised people. Here the reach itself was wrong.',
      },
    ],
  },
  {
    id: 'CF-0002',
    meaning:
      'New code or a new dependency version reached production carrying a fault. The defect lives in what was shipped. It is not about how a setting was applied.',
    situations: [
      'A new feature crashes on a case the tests never covered.',
      'An upgraded library behaves differently under real traffic.',
      'A quick fix introduces a second bug.',
    ],
    clues: [
      'Trouble begins soon after a deploy time.',
      'Errors trace back to the newly shipped code path.',
      'Rolling the release back makes the problem go away.',
    ],
    confusedWith: [
      { id: 'CF-0001', howToTell: 'Config Blast Radius: only a setting changed. If no code shipped, think there.' },
      {
        id: 'CF-0003',
        howToTell: 'Surprise Side Effect: the change worked as designed and surprised everyone. Bad Release: the code was simply wrong.',
      },
      { id: 'CF-0004', howToTell: 'Migration Mismatch: the app code stayed the same and stored data changed under it.' },
    ],
  },
  {
    id: 'CF-0003',
    meaning:
      'A planned change, such as maintenance, tuning or an emergency fix, did exactly what it was meant to do, and that still caused an effect nobody expected. Nothing was broken or aimed wrong. The surprise came from how the rest of the system reacted.',
    situations: [
      'Restarting a cache tier sends all reads to the database.',
      'A planned DNS setting makes lookups spike.',
      'Emergency maintenance touches something nobody knew depended on it.',
    ],
    clues: [
      'The change was planned and carried out correctly.',
      'The damage differs from what the plan predicted.',
      'Nobody saw the link between the change and the harm.',
    ],
    confusedWith: [
      { id: 'CF-0001', howToTell: 'Config Blast Radius: the change reached the wrong scope. Here it reached exactly its target.' },
      { id: 'CF-0002', howToTell: 'Bad Release: the new code had a defect. Here nothing was defective.' },
      { id: 'CF-0008', howToTell: 'Stale Cache: the cache held wrong data. Here the cache was emptied on purpose.' },
    ],
  },
  {
    id: 'CF-0004',
    meaning:
      'Stored data or its structure was changed, such as a rename, a rewrite or a format change, while running code still expected the old form. The code and the data no longer agreed.',
    situations: [
      'A column is renamed while a job still reads the old name.',
      'Records are converted to a new format before every service understands it.',
      'A backfill rewrites values that older code cannot parse.',
    ],
    clues: [
      'Errors mention missing columns, fields or unreadable records.',
      'A migration or schema change ran just before.',
      'The application code itself did not change.',
    ],
    confusedWith: [
      { id: 'CF-0002', howToTell: 'Bad Release: the code changed. Here the data changed and the code stayed put.' },
      { id: 'CF-0005', howToTell: 'Unexpected Input: odd data hit a fragile path. Here the data shape itself was changed on purpose.' },
      { id: 'CF-0006', howToTell: 'Overflow: a value outgrew its type with no migration. Here someone restructured the data.' },
    ],
  },
  {
    id: 'CF-0005',
    meaning:
      'Code received input that was malformed, oversized or otherwise outside what it was built for, and mishandled it. The input could be a blank field, a huge file or an unusual character.',
    situations: [
      'A blank amount crashes a bulk import.',
      'An oversized upload exhausts a parser.',
      'Unusual characters break a query builder.',
    ],
    clues: [
      'Only requests with some odd trait fail; the rest are fine.',
      'Logs show parse or validation errors for specific records.',
      'The same code works for ordinary input.',
    ],
    confusedWith: [
      { id: 'CF-0004', howToTell: 'Migration Mismatch: every row was ordinary but the stored shape had been changed.' },
      { id: 'CF-0006', howToTell: 'Overflow: a value grew past what its type could hold through normal use.' },
      { id: 'CF-0002', howToTell: 'Bad Release names the faulty code shipping. Both can apply; this card names the input it mishandled.' },
    ],
  },
  {
    id: 'CF-0006',
    meaning:
      'A number, ID, counter, clock value or quota grew past the range its type or logic could represent. Past that point, reads or writes fail or wrap around.',
    situations: [
      'A 32-bit counter passes its largest value.',
      'A date field runs past the years it supports.',
      'Auto-increment IDs use up their column.',
    ],
    clues: [
      'Failures begin at one exact value or record.',
      'Errors mention range, overflow or out-of-bounds numbers.',
      'The code worked until a value crossed a threshold.',
    ],
    confusedWith: [
      { id: 'CF-0019', howToTell: 'Limit Hit: someone configured the cap. Here the type itself could not hold the number.' },
      { id: 'CF-0004', howToTell: 'Migration Mismatch: data was restructured. Here nothing was changed; a value just grew.' },
      { id: 'CF-0005', howToTell: 'Unexpected Input: a caller sent something odd. Here ordinary use pushed the value over.' },
    ],
  },
  {
    id: 'CF-0007',
    meaning:
      'Routine cleanup, retirement or deletion removed data or resources that were still in use. The action was meant to be tidy, but its list of targets was wrong or out of date.',
    situations: [
      'A cleanup job deletes folders that long jobs still read.',
      'A server that looked unused is retired too early.',
      'A retention rule purges records someone still needs.',
    ],
    clues: [
      'Things go missing right after a cleanup ran.',
      'Errors report absent files, resources or records.',
      'The removed items looked idle but were not.',
    ],
    confusedWith: [
      { id: 'CF-0004', howToTell: 'Migration Mismatch: data was reshaped for a new design. Here things were thrown away as unneeded.' },
      { id: 'CF-0026', howToTell: 'Safety Trip: a protective control acted. Both can apply when a guard script does the deleting.' },
      { id: 'CF-0035', howToTell: 'Hardware Failure: the thing broke by itself. Here someone or something removed it.' },
    ],
  },
  {
    id: 'CF-0026',
    meaning:
      "A protective control, such as a rate limit, load shedder, lockout or cleanup guard, did its job as designed, and the action it took was the outage. The safeguard worked as built; what it did hurt service.",
    situations: [
      'A rate limiter blocks a busy but legitimate partner.',
      'A disk guard deletes files to free space and breaks running jobs.',
      'A lockout rule shuts out real users along with an attacker.',
    ],
    clues: [
      "The safeguard's own log shows it acting on its rules.",
      'Service failed at the moment protection engaged.',
      'Switching the protection off restores service.',
    ],
    confusedWith: [
      { id: 'CF-0019', howToTell: 'Limit Hit: a hard cap was reached. Here a control chose to act before any cap.' },
      { id: 'CF-0007', howToTell: 'Deleted While In Use names what was removed. Safety Trip names why the guard acted.' },
      { id: 'CF-0036', howToTell: 'External Restriction: an outside party applied the limit. Here your own control did.' },
    ],
  },
  {
    id: 'CF-0039',
    meaning:
      'A written procedure did not match how the system really works, or left the order or timing unclear. People followed it faithfully, and it still steered them wrong or slowed them down.',
    situations: [
      'A runbook names a tool that was retired last year.',
      'Steps assume a layout the system no longer has.',
      'Two steps have no stated order, and the wrong order does harm.',
    ],
    clues: [
      'Responders follow the document and hit steps that do not exist.',
      'Time goes to working out what the document meant.',
      'Recovery stalls on an out-of-date procedure.',
    ],
    confusedWith: [
      { id: 'CF-0025', howToTell: 'Slow Recovery: recovery needed work nobody planned. Here the written plan itself was wrong.' },
      { id: 'CF-0012', howToTell: 'Failed Fix: the action ran and did not restore service. Here the instructions were the problem.' },
    ],
  },
  {
    id: 'CF-0008',
    meaning:
      'A cache, index or other derived copy stopped matching its source of truth, so the system gave out answers that were out of date or wrong. The copy was present and answering; its content was the problem.',
    situations: [
      'Cached prices linger after the rule behind them changes.',
      'A search index misses items edited a minute ago.',
      'A precomputed total is not updated when its inputs change.',
    ],
    clues: [
      'Old values come back quickly, with no errors.',
      'Fixing the source does not fix what users see.',
      'Clearing or rebuilding the copy fixes it.',
    ],
    confusedWith: [
      { id: 'CF-0022', howToTell: 'Cold Cache: the cache was empty and slow. Here it was full and wrong.' },
      { id: 'CF-0009', howToTell: 'Wrong Replica: a promoted database held different data. Here a derived copy drifted.' },
      { id: 'CF-0003', howToTell: 'Surprise Side Effect: emptying the cache on purpose caused the harm. Here stale content did.' },
    ],
  },
  {
    id: 'CF-0009',
    meaning:
      'During a failover, the standby that took over held different state from the old primary, such as missing recent writes or mismatched sequences. Service came back, but on data that did not match.',
    situations: [
      'A replica minutes behind takes over and recent writes vanish.',
      'ID sequences restart or collide after promotion.',
      'Writes acknowledged by the old primary never reached the new one.',
    ],
    clues: [
      'Service recovers but recent records are missing.',
      'Counters or IDs jump or repeat after failover.',
      'The size of the gap matches replication lag at failure time.',
    ],
    confusedWith: [
      { id: 'CF-0012', howToTell: 'Failed Fix: the failover did not restore service. Here service returned on different data.' },
      { id: 'CF-0008', howToTell: 'Stale Cache: a derived copy was wrong. Here the promoted database itself held different state.' },
      { id: 'CF-0025', howToTell: 'Slow Recovery: the rebuilding was the long manual work. Here the gap is how it began.' },
    ],
  },
  {
    id: 'CF-0010',
    meaning:
      'A health or readiness signal kept saying healthy while the component was failing, so traffic kept going to it. The check tested something easier than real work, such as whether the process was running.',
    situations: [
      'A check pings the process while its database link is dead.',
      'An instance reports OK while stuck on a full disk.',
      'Readiness passes before the app can really serve requests.',
    ],
    clues: [
      'Load balancers and dashboards show every instance green.',
      'Users hit errors from instances marked healthy.',
      'The check never exercises the failing path.',
    ],
    confusedWith: [
      {
        id: 'CF-0011',
        howToTell:
          'Blind Monitoring: people saw the problem late, or measured the wrong thing. Here an automated signal kept sending traffic to the broken part.',
      },
      {
        id: 'CF-0037',
        howToTell: 'Miscounted Faults: signals worked but could not separate overlapping faults. Here one signal was simply wrong.',
      },
    ],
  },
  {
    id: 'CF-0037',
    meaning:
      'Several faults at once could not be told apart from the signals, so they were treated as one problem, or one problem looked like several. A fix that seemed to work could also point the team away from a fault that was still there. It is about how many faults there are and which is which.',
    situations: [
      'Two unrelated outages start together and share one ticket.',
      'One failure shows up in several places and gets several investigations.',
      'A partial recovery convinces responders they found the cause.',
    ],
    clues: [
      'Logs show two different kinds of errors in one incident.',
      'A fix helps only some of the symptoms.',
      'The team chases a cause that explains only part of the damage.',
    ],
    confusedWith: [
      {
        id: 'CF-0010',
        howToTell: 'Lying Health Check: one signal reported healthy while failing. Here signals were honest but faults overlapped.',
      },
      {
        id: 'CF-0011',
        howToTell: 'Blind Monitoring: the signal came late or measured the wrong thing. Here signals arrived, but blurred several faults.',
      },
      { id: 'CF-0028', howToTell: 'Internal Dependency Down: one failing service spread. Here there were separate faults.' },
    ],
  },
  {
    id: 'CF-0011',
    meaning:
      'Monitoring was late, was itself degraded, or measured the wrong thing, so people learned of the failure slowly or saw normal readings during it. The problem could be observed in principle, but not in time or in the right way.',
    situations: [
      'An alert watches an average that hides a slow tail.',
      'A success-rate chart blends all traffic and hides one broken type.',
      'A dashboard counts any HTTP 200 as a success.',
    ],
    clues: [
      'Customers report trouble well before any alert fires.',
      'Dashboards stay green while support tickets pile up.',
      'The metric watched does not cover the failing path.',
    ],
    confusedWith: [
      { id: 'CF-0010', howToTell: 'Lying Health Check: an automated check kept routing traffic to a failing part. Here humans were kept in the dark.' },
      { id: 'CF-0037', howToTell: 'Miscounted Faults: signals showed trouble but could not separate faults.' },
      { id: 'CF-0025', howToTell: 'Slow Recovery: the fix was slow once the problem was known. Here knowing was slow.' },
    ],
  },
  {
    id: 'CF-0012',
    meaning:
      'A corrective action, such as a rollback, failover or restart, did not return service to its earlier healthy state, and sometimes made things worse. The remedy ran, but the system did not recover as expected.',
    situations: [
      'A restart sends every worker back into the same failing step.',
      'A rollback cannot undo a change already made to data.',
      'A failover target cannot carry the full load.',
    ],
    clues: [
      'Things get worse right after the fix.',
      'The same error returns after a restart.',
      'Responders expected a clean return and did not get one.',
    ],
    confusedWith: [
      { id: 'CF-0025', howToTell: 'Slow Recovery: the fix worked but took long. Here the fix itself failed or hurt.' },
      { id: 'CF-0009', howToTell: 'Wrong Replica: the failover worked, but the new primary held different data.' },
      { id: 'CF-0024', howToTell: 'Lingering Backlog: the fix worked and a queue still had to drain.' },
    ],
  },
  {
    id: 'CF-0025',
    meaning:
      'Restoring service needed steps, time or decisions the plan had not allowed for, so recovery dragged on. The repair was moving forward; it was just slower or more manual than anyone planned.',
    situations: [
      'Adding capacity needs a hand-run script and approvals.',
      'Lost records are rebuilt by hand from other logs.',
      'Responders hunt for who can approve the next step.',
    ],
    clues: [
      'The cause is known but service stays down for hours.',
      'Manual work and approvals fill the timeline.',
      'The plan assumed a faster, simpler recovery.',
    ],
    confusedWith: [
      { id: 'CF-0012', howToTell: 'Failed Fix: the action did not work or made things worse. Here it worked slowly.' },
      { id: 'CF-0024', howToTell: 'Lingering Backlog: the fix was done and a queue was still draining.' },
      { id: 'CF-0039', howToTell: 'Stale Runbook: the written steps were wrong. Here the steps simply took long or were missing.' },
    ],
  },
  {
    id: 'CF-0028',
    meaning:
      'A service or data store run inside the organization stopped working, and the systems calling it failed or slowed. This includes internal databases and storage that stopped serving requests. The trouble starts in the dependency and spreads to its callers.',
    situations: [
      'A profile service goes down and every screen that calls it errors.',
      'An internal database stops answering and dependent APIs time out.',
      'A storage cluster fails and several apps stall.',
    ],
    clues: [
      'Failing requests all wait on one internal service.',
      'The broken piece belongs to another team in the company.',
      "Callers' own health is fine apart from the waiting.",
    ],
    confusedWith: [
      { id: 'CF-0033', howToTell: 'Provider Outage: the failing system belongs to an outside company. Here it is yours.' },
      { id: 'CF-0018', howToTell: 'Runaway Query: the database was up but swamped by heavy queries. Here it stopped serving.' },
      { id: 'CF-0030', howToTell: 'Network Loss: the service was up but unreachable. Here the service itself was down.' },
    ],
  },
  {
    id: 'CF-0030',
    meaning:
      'The network lost packets, split into parts, or had less capacity than usual, so components could not talk reliably. The machines were fine; the paths between them were not.',
    situations: [
      'A carrier link drops to a fraction of its capacity.',
      'A partition cuts one region off from another.',
      'A faulty switch drops packets.',
    ],
    clues: [
      'Timeouts between sites while each side looks healthy.',
      'A host is reachable from some places and not others.',
      'Packet-loss and latency graphs spike.',
    ],
    confusedWith: [
      { id: 'CF-0031', howToTell: 'DNS Failure: names fail to resolve but connecting by IP address works.' },
      { id: 'CF-0028', howToTell: 'Internal Dependency Down: the service itself was down. Here it was fine but unreachable.' },
      { id: 'CF-0034', howToTell: 'Facility Failure: a whole site lost power or cooling. Here the site was up and the link was thin.' },
    ],
  },
  {
    id: 'CF-0031',
    meaning:
      'Name lookups returned wrong answers or none, so clients could not find services that were running fine. Connecting by raw address would still have worked.',
    situations: [
      'An overloaded resolver drops lookups.',
      'A record still points to an old address.',
      'A mistaken DNS change removes entries.',
    ],
    clues: [
      'Errors say host not found or unknown name.',
      'Direct IP connections succeed.',
      'Servers look healthy while lookups fail.',
    ],
    confusedWith: [
      { id: 'CF-0030', howToTell: 'Network Loss: packets are lost. Here the name lookup failed and the network was fine.' },
      { id: 'CF-0027', howToTell: 'Expired Credential: connection works, then the handshake fails. Here the lookup fails first.' },
      { id: 'CF-0003', howToTell: 'Surprise Side Effect can be why the lookups failed; DNS Failure is what broke.' },
    ],
  },
  {
    id: 'CF-0032',
    meaning:
      'The login, token or identity service failed, so everything that relied on it could not confirm who a user or system was. The rest of the stack could be fine and still be locked out.',
    situations: [
      'A token service cannot reach its key store, so logins fail.',
      'An internal identity service is overloaded.',
      'Service-to-service identity checks stop passing.',
    ],
    clues: [
      'Sign-ins and token checks fail while other pages load.',
      'Unauthorized errors spread across unrelated services.',
      'The identity service shows errors or is unreachable.',
    ],
    confusedWith: [
      { id: 'CF-0027', howToTell: 'Expired Credential: an expiry date passed. Here the identity service itself failed.' },
      { id: 'CF-0028', howToTell: 'Internal Dependency Down: any internal service. This card is for the identity one.' },
      { id: 'CF-0030', howToTell: 'Network Loss: connections could not be made. Here they worked and identity checks failed.' },
    ],
  },
  {
    id: 'CF-0035',
    meaning:
      'A physical or virtual host, disk or other piece of infrastructure failed underneath the software. The code and config were fine; the thing they ran on stopped working.',
    situations: [
      'A disk error takes down the main database host.',
      'A host crashes and its workloads disappear.',
      'A virtual machine is lost when its underlying host dies.',
    ],
    clues: [
      'Logs show disk, memory or host-level errors.',
      'One machine fails while its neighbors are healthy.',
      'Replacing the machine restores service.',
    ],
    confusedWith: [
      { id: 'CF-0017', howToTell: 'Out of Memory: the host was healthy; software used up its memory.' },
      { id: 'CF-0034', howToTell: 'Facility Failure: a whole site lost power or cooling, not one machine.' },
      { id: 'CF-0014', howToTell: 'Hot Node: the machine was overloaded by placement, not broken.' },
    ],
  },
  {
    id: 'CF-0013',
    meaning:
      'Two or more automated systems, each correct on its own, made conflicting changes to the same shared state. Their changes undid or fought each other.',
    situations: [
      'An autoscaler removes instances while a deploy tool adds them.',
      'Two controllers set one value differently.',
      'A cleanup bot deletes what a sync bot just recreated.',
    ],
    clues: [
      'Counts or settings swing back and forth.',
      'Logs show two tools acting on the same thing.',
      'Each tool reports that it is doing its job.',
    ],
    confusedWith: [
      { id: 'CF-0014', howToTell: 'Hot Node: the lopsided load is a result. Dueling Automation is the fight behind it.' },
      { id: 'CF-0003', howToTell: 'Surprise Side Effect: one planned change had an unexpected effect. Here two automations clashed.' },
    ],
  },
  {
    id: 'CF-0014',
    meaning:
      'A scheduler or placement system put too much work on one node, shard or partition while others had room. Total capacity was fine; the spread was lopsided.',
    situations: [
      'Most containers land on a single host.',
      'One popular key sends all its traffic to one shard.',
      'A rebalance piles partitions onto a new node.',
    ],
    clues: [
      'One host or shard is saturated while neighbors idle.',
      'Cluster-wide averages look comfortable.',
      'Moving work off that node helps.',
    ],
    confusedWith: [
      { id: 'CF-0015', howToTell: 'Over Capacity: total demand was too big. Here other nodes had room.' },
      { id: 'CF-0017', howToTell: 'Out of Memory: memory ran out everywhere or by a leak. Here placement piled it on one node.' },
      { id: 'CF-0035', howToTell: 'Hardware Failure: the node was broken. Here it was healthy but overloaded.' },
    ],
  },
  {
    id: 'CF-0015',
    meaning:
      'Demand, including unexpected or abusive traffic, grew beyond what had been provisioned. The system was sized for less load than it received.',
    situations: [
      'A sale brings eight times a normal day.',
      'A viral post sends sudden crowds.',
      'A scraper floods the API.',
    ],
    clues: [
      'Every server is busy at once.',
      'Traffic graphs jump well above plan.',
      'Adding capacity helps right away.',
    ],
    confusedWith: [
      { id: 'CF-0019', howToTell: 'Limit Hit: a configured cap blocked growth. Here the servers themselves ran out.' },
      { id: 'CF-0020', howToTell: 'Outgrown: capacity was added but too slowly for the climb. Here one surge beat the sizing.' },
      { id: 'CF-0021', howToTell: 'Retry Storm: the extra load was clients resending. Here real new demand arrived.' },
    ],
  },
  {
    id: 'CF-0016',
    meaning:
      'Work piled up waiting on a shared resource, such as a connection pool, thread pool or lock, until the waiters held every slot and nothing could be served. Even work unrelated to the slow part stalled.',
    situations: [
      'Every worker waits on one slow internal service.',
      'Long transactions fill the connection pool.',
      'A lock held by one stuck process blocks everyone.',
    ],
    clues: [
      'All workers are busy but CPU stays low.',
      'Even unrelated features hang.',
      'Requests wait in line rather than fail fast.',
    ],
    confusedWith: [
      { id: 'CF-0018', howToTell: 'Runaway Query: heavy queries burned the store. Here the pool was full of waiters.' },
      { id: 'CF-0028', howToTell: 'Internal Dependency Down is the failure; Queue Lockup is how the waiting spread.' },
      { id: 'CF-0015', howToTell: 'Over Capacity: too much demand. Here volume was normal and workers were stuck.' },
    ],
  },
  {
    id: 'CF-0017',
    meaning:
      'Memory use grew until processes stopped responding or were killed. The growth can come from a leak, a huge workload or processes nobody expected.',
    situations: [
      'A leak slowly eats memory until hosts restart.',
      'A huge result set is loaded all at once.',
      'Unknown processes fill the memory of many hosts.',
    ],
    clues: [
      'Memory alarms come before restarts or killed processes.',
      'Memory climbs steadily on affected hosts.',
      'A restart helps briefly, then the problem returns.',
    ],
    confusedWith: [
      { id: 'CF-0035', howToTell: 'Hardware Failure: the machine broke. Here it worked and ran out of memory.' },
      { id: 'CF-0014', howToTell: 'Hot Node: one node is overloaded by placement. Memory trouble on every host points here.' },
      { id: 'CF-0023', howToTell: 'Noisy Batch Job: a background task crowding out users. Memory may be what it eats.' },
    ],
  },
  {
    id: 'CF-0018',
    meaning:
      'Expensive, parallel or unbounded queries used up a data store, so everything else on it slowed or stopped. The store was healthy; it was just busy with something heavy.',
    situations: [
      'A report scans a whole table on the live database.',
      'A missing filter returns millions of rows.',
      'Many analytical queries start at the same moment.',
    ],
    clues: [
      'Database CPU or disk is pegged.',
      'A few queries dominate the load.',
      'Pausing those queries brings relief.',
    ],
    confusedWith: [
      { id: 'CF-0016', howToTell: 'Queue Lockup: the pool is full of waiters and the database is quiet. Here the database is busy.' },
      { id: 'CF-0023', howToTell: 'Noisy Batch Job: the background job behind the queries. Runaway Query is the load on the store.' },
      { id: 'CF-0015', howToTell: 'Over Capacity: many ordinary requests. Here a few heavy queries did the damage.' },
    ],
  },
  {
    id: 'CF-0019',
    meaning:
      'A configured ceiling, such as a connection cap, quota or instance limit, was reached, so the system could not grow or accept more work. Demand may have been ordinary at the time.',
    situations: [
      "A cloud account's instance quota stops the autoscaler.",
      'A database reaches its maximum connections.',
      'An API quota runs out mid-day.',
    ],
    clues: [
      'Errors name a quota, cap or limit.',
      'Usage sits flat at one exact number.',
      'Raising the limit fixes it quickly.',
    ],
    confusedWith: [
      { id: 'CF-0015', howToTell: 'Over Capacity: servers truly ran out of CPU or memory. Here a cap stopped growth first.' },
      { id: 'CF-0020', howToTell: 'Outgrown: capacity was added too slowly. Here a ceiling blocked adding it.' },
      { id: 'CF-0026', howToTell: 'Safety Trip: a control chose to act before any cap. Here a cap was simply reached.' },
    ],
  },
  {
    id: 'CF-0020',
    meaning:
      'Demand grew, and the scaling or provisioning response did come, but slower than the load arrived. Capacity kept falling behind, whether over months or over minutes.',
    situations: [
      'Signups grow monthly while servers arrive quarterly.',
      'An autoscaler adds machines slower than traffic climbs.',
      'New customer data fills storage faster than it is expanded.',
    ],
    clues: [
      'Busy hours get a little worse every week.',
      "Capacity additions are sized for last period's load.",
      'There is no single spike, just a long trend.',
    ],
    confusedWith: [
      { id: 'CF-0015', howToTell: 'Over Capacity: one surge beat the sizing. Here demand climbed and capacity lagged.' },
      { id: 'CF-0019', howToTell: 'Limit Hit: a cap prevented adding capacity. Here there was no cap in the way.' },
      { id: 'CF-0025', howToTell: 'Slow Recovery: slowness during an incident. Here slowness is in the growth plan.' },
    ],
  },
  {
    id: 'CF-0021',
    meaning:
      'Clients retried or reconnected all together, often at the worst moment, multiplying load on a service trying to recover. The retries kept it down after the original trigger had passed.',
    situations: [
      'A fix lands but resending clients keep the service overloaded.',
      'Every client reconnects at once after an outage.',
      'Retries without backoff multiply each failed call.',
    ],
    clues: [
      'Request volume is several times normal with no user growth.',
      'Load persists after the root cause is fixed.',
      'Many identical requests repeat from the same clients.',
    ],
    confusedWith: [
      { id: 'CF-0015', howToTell: 'Over Capacity: new demand. Here the extra load is the same requests sent again.' },
      { id: 'CF-0024', howToTell: 'Lingering Backlog: real queued work. Here clients keep resending.' },
    ],
  },
  {
    id: 'CF-0022',
    meaning:
      'Cached data was lost, expired or empty, so requests the cache normally absorbed all hit a slower backing store at once. The cache was not wrong; it was empty.',
    situations: [
      'A cache restart sends every read to the database.',
      'Traffic fails over to a region whose cache is empty.',
      'Many entries expire at the same moment.',
    ],
    clues: [
      'Backing store load spikes right after a restart or failover.',
      'Traffic is normal but database CPU is not.',
      'Load eases as the cache fills.',
    ],
    confusedWith: [
      { id: 'CF-0008', howToTell: 'Stale Cache: the cache was full but held wrong data. Here it held nothing.' },
      { id: 'CF-0018', howToTell: 'Runaway Query: a few heavy queries. Here ordinary queries all arrived together.' },
      { id: 'CF-0015', howToTell: 'Over Capacity: demand rose. Here demand stayed flat and the cache stopped absorbing it.' },
    ],
  },
  {
    id: 'CF-0023',
    meaning:
      'A bulk or background task, such as a backfill, replay, report or mass deletion, competed with user traffic for shared resources. The job ran correctly; it simply crowded out the live service.',
    situations: [
      'A scheduled report scans the live database.',
      'A backfill saturates disk during business hours.',
      'A mass delete starves normal requests.',
    ],
    clues: [
      'Slowness starts when a scheduled or one-off job starts.',
      'Pausing the job restores speed.',
      'The job and the users share a database or disk.',
    ],
    confusedWith: [
      { id: 'CF-0018', howToTell: 'Runaway Query: the heavy queries on the store. Noisy Batch Job names the job that sent them.' },
      { id: 'CF-0016', howToTell: 'Queue Lockup: requests wait on a full pool. Here a job competes for raw capacity.' },
      { id: 'CF-0038', howToTell: 'Intruder: the work was started by an outsider. Here it is your own scheduled job.' },
    ],
  },
  {
    id: 'CF-0024',
    meaning:
      'Work queued up during a fault and kept the service slow or wrong after the fault was gone. The system had recovered, but the pile still had to drain.',
    situations: [
      'Invoices wait through an outage and send for hours after.',
      'The cache is warm again but orders still queue.',
      'Queue depth stays high long after the fix.',
    ],
    clues: [
      'The cause is fixed but delays continue.',
      'Queue depth or lag shrinks slowly.',
      'Everything is correct, just late.',
    ],
    confusedWith: [
      { id: 'CF-0021', howToTell: 'Retry Storm: clients keep resending the same requests. Here the work is real and queued.' },
      { id: 'CF-0025', howToTell: 'Slow Recovery: the fix itself was slow or manual. Here the fix was done.' },
      { id: 'CF-0012', howToTell: 'Failed Fix: the action did not restore service. Here service was back and behind.' },
    ],
  },
  {
    id: 'CF-0027',
    meaning:
      'A credential or certificate with an end date passed it while still in use, and what depended on it stopped working. Nothing was attacked or broken; the clock simply ran out.',
    situations: [
      'An internal certificate lapses at midnight.',
      'An API key reaches its expiry date.',
      'A service account token runs past its end date.',
    ],
    clues: [
      'Handshake or authentication errors begin at an exact time.',
      'Several services fail together when they share a credential.',
      'Renewing the credential fixes it.',
    ],
    confusedWith: [
      { id: 'CF-0032', howToTell: 'Auth Down: the identity service itself failed. Here a credential timed out.' },
      { id: 'CF-0038', howToTell: 'Intruder: a valid key was misused. An expired key simply stops working.' },
      { id: 'CF-0031', howToTell: 'DNS Failure: lookups fail before connecting. Here the connection works and the handshake fails.' },
    ],
  },
  {
    id: 'CF-0033',
    meaning:
      'An outside provider, such as a payment processor, cloud service or data vendor, became unavailable or degraded, and customers who depend on it were affected. Often many customers report the same incident.',
    situations: [
      'A payment processor times out every purchase.',
      "A cloud region has an incident on the provider's side.",
      'An email or SMS vendor stops delivering.',
    ],
    clues: [
      "The provider's status page shows an incident.",
      'Our own systems are healthy apart from waiting.',
      'Other companies report the same trouble.',
    ],
    confusedWith: [
      { id: 'CF-0028', howToTell: 'Internal Dependency Down: the failing service belongs to your company.' },
      { id: 'CF-0036', howToTell: 'External Restriction: the provider is up and refuses on purpose. Here it is failing.' },
    ],
  },
  {
    id: 'CF-0034',
    meaning:
      'A facility lost utility or backup power or cooling, or was physically hit by an event such as a storm, fire or flood. Everything housed there was affected at once.',
    situations: [
      'A backup generator fails to start during a power cut.',
      'Cooling fails and hosts shut down from heat.',
      'A storm floods a data hall.',
    ],
    clues: [
      'Every host in one site or hall goes offline together.',
      'Facility or utility notices mention power or cooling.',
      'Other sites run normally.',
    ],
    confusedWith: [
      { id: 'CF-0035', howToTell: 'Hardware Failure: one host or disk broke. Here a whole site went dark.' },
      { id: 'CF-0030', howToTell: 'Network Loss: the site had power but its connectivity was lost.' },
      { id: 'CF-0033', howToTell: 'Provider Outage: a vendor service degraded. Here the physical site itself was hit.' },
    ],
  },
  {
    id: 'CF-0036',
    meaning:
      'An outside authority or policy, such as a regulator, a licence, a network operator or a reputation system, limited what the service could do. The restriction was applied on purpose, and the organization could not lift it alone.',
    situations: [
      'A card network puts a merchant account on hold.',
      'An email provider blocks sending after spam reports.',
      'A regulator orders a feature off in one region.',
    ],
    clues: [
      'Errors name a hold, block or policy.',
      'The outside party answers quickly but refuses.',
      'Only that party can lift the restriction.',
    ],
    confusedWith: [
      { id: 'CF-0033', howToTell: 'Provider Outage: the provider failed or slowed. Here it works and says no.' },
      { id: 'CF-0027', howToTell: 'Expired Credential: our own credential lapsed. Here our credentials were valid.' },
      { id: 'CF-0026', howToTell: 'Safety Trip: our own safeguard acted. Here an outside party did.' },
    ],
  },
  {
    id: 'CF-0038',
    meaning:
      'An unauthorized third party gained access and took actions in the system, for example through stolen credentials, hijacked sessions or malicious code in a supply chain. The harm came from what they did with that access.',
    situations: [
      'A leftover access key is used from an unknown address.',
      'A stolen session token is replayed.',
      'A poisoned dependency update runs hostile code.',
    ],
    clues: [
      'Audit logs show access from unfamiliar places.',
      'Activity appears that nobody scheduled or recognizes.',
      'Credentials that should have been retired still work.',
    ],
    confusedWith: [
      { id: 'CF-0023', howToTell: 'Noisy Batch Job: the heavy work was started by your own jobs.' },
      { id: 'CF-0027', howToTell: 'Expired Credential: the key had run out. Here a valid key was misused.' },
      { id: 'CF-0018', howToTell: 'Runaway Query: the load came from your own tools, with no foreign access.' },
    ],
  },
]

export const CARD_INFO: Record<string, CardInfo> = Object.fromEntries(
  RAW.map(info => [info.id, { ...info, catalogUrl: catalogUrl(info.id) }])
)

/**
 * The "how to tell apart" line to show on the reveal screen for a wrong or
 * missed card. Prefers a look-alike from `preferred` (the other cards in this
 * incident), then falls back to the card's first entry.
 */
export function tellApart(cardId: string, preferred: readonly string[] = []): ConfusedWith | undefined {
  const list = CARD_INFO[cardId]?.confusedWith ?? []
  return list.find(c => preferred.includes(c.id)) ?? list[0]
}

/** Nickname of a card, or its ID if unknown. */
export function cardLabel(id: string): string {
  return CARDS_BY_ID[id]?.nickname ?? id
}
