export type Decoy = { id: string; whyNot: string }

export type Incident = {
  id: string
  title: string
  clues: [string, string, string] // revealed in order
  factors: string[] // 2 or 3 CF ids
  decoys: Decoy[] // 2 or 3
  explanation: string // shown on reveal
}

// The 4 seeds come straight from the issue and are used unchanged.
export const seeds: Incident[] = [
  {
    id: 'friday-flag',
    title: 'The Friday Flag',
    clues: [
      '14:02 Checkout errors jump in every region at once. No deploy in the last 6 hours.',
      '14:10 The load balancer shows every instance healthy. A flag change meant for one region went out at 14:01.',
      '14:25 Flag reverted. Errors continue: clients are resending failed requests at 4x normal volume.',
    ],
    factors: ['CF-0001', 'CF-0010', 'CF-0021'],
    decoys: [
      { id: 'CF-0002', whyNot: 'No code shipped; a config flag changed.' },
      { id: 'CF-0011', whyNot: 'Alerts fired on time; the health check was the signal that lied.' },
      { id: 'CF-0015', whyNot: 'Organic demand was normal; the extra load was retries.' },
    ],
    explanation:
      'A flag scoped to one region applied everywhere. Health checks only tested that the process was up, so instances looked fine. After the revert, client retries kept the service overloaded.',
  },
  {
    id: 'midnight-renewal',
    title: 'Midnight Renewal',
    clues: [
      '00:00 Every internal API call starts failing with handshake errors.',
      '00:07 Users cannot log in; the token service cannot reach its key store.',
      '00:40 On-call follows the renewal runbook. It points to a tool retired last year.',
    ],
    factors: ['CF-0027', 'CF-0032', 'CF-0039'],
    decoys: [
      { id: 'CF-0031', whyNot: 'Names resolved fine; the handshake failed after connecting.' },
      { id: 'CF-0030', whyNot: 'The network path was up; connections were refused at TLS.' },
    ],
    explanation:
      'An internal certificate expired at midnight. The login service depended on it and went down. Recovery dragged because the written procedure was out of date.',
  },
  {
    id: 'cache-flush',
    title: 'Routine Maintenance',
    clues: [
      '09:00 Scheduled maintenance restarts the cache tier. 09:01 Database CPU hits 100%.',
      '09:05 Every page view is reading straight from the database. Traffic is at normal levels.',
      '09:30 The cache is warm again, but order processing is 40 minutes behind and still draining.',
    ],
    factors: ['CF-0003', 'CF-0022', 'CF-0024'],
    decoys: [
      { id: 'CF-0008', whyNot: 'The cache was empty, not wrong.' },
      { id: 'CF-0018', whyNot: 'Queries were ordinary; there were simply all of them at once.' },
      { id: 'CF-0015', whyNot: 'Demand did not rise; the cache stopped absorbing it.' },
    ],
    explanation:
      'A planned restart emptied the cache, which nobody expected to matter. The database took the full read load, and the queue that built up kept the service degraded after the cache recovered.',
  },
  {
    id: 'two-robots',
    title: 'Two Robots',
    clues: [
      "16:20 The API fleet's instance count swings between 12 and 30 every few minutes.",
      '16:26 The deploy tool is adding instances for a rollout while the autoscaler removes them as surplus.',
      '16:31 Most containers have landed on one host, which is killed for running out of memory.',
    ],
    factors: ['CF-0013', 'CF-0014', 'CF-0017'],
    decoys: [
      { id: 'CF-0035', whyNot: 'The host was healthy hardware; it was overloaded.' },
      { id: 'CF-0015', whyNot: 'Traffic was flat; placement was the problem.' },
    ],
    explanation:
      'Two automated systems fought over the same fleet. The churn packed workloads onto one host, which ran out of memory.',
  },
]

export const newIncidents: Incident[] = [
  {
    id: 'bulk-refunds',
    title: 'The Blank Row',
    clues: [
      '10:15 Bulk refund uploads start failing for some merchants. Single refunds and overall payment success look normal.',
      '10:40 Every failing upload has at least one row with a blank amount. The bulk refund feature shipped in a release at 10:00.',
      '11:30 An alert finally fires. The success-rate chart blends every payment type, so a few failed uploads barely moved it. The release is rolled back at 11:41.',
    ],
    factors: ['CF-0002', 'CF-0005', 'CF-0011'],
    decoys: [
      { id: 'CF-0001', whyNot: 'No setting changed; new code shipped.' },
      {
        id: 'CF-0003',
        whyNot: 'The new code was simply wrong for a case it should have handled. It did not work as designed and then surprise anyone.',
      },
      {
        id: 'CF-0010',
        whyNot: 'No component reported itself healthy while failing. A chart blended all payments and hid the problem.',
      },
    ],
    explanation:
      'The new bulk refund release crashed on rows with a blank amount, input it should have rejected cleanly. The success-rate chart averaged all payment types, so it stayed normal for over an hour.',
  },
  {
    id: 'view-counter',
    title: 'The Counter That Ran Out',
    clues: [
      '20:02 Playback fails for the new season premiere. Viewers see a spinner, then an error.',
      "20:09 The errors come from the write that records each view. The failing row is the premiere's, with a count above two billion.",
      '20:20 On-call restarts the playback service. Workers hit the same failing write and crash again, and now every title is slow. 20:50 The column is widened to 64 bits and errors stop.',
    ],
    factors: ['CF-0006', 'CF-0012'],
    decoys: [
      { id: 'CF-0019', whyNot: 'Nobody configured a cap. The column type could not hold a number that big.' },
      {
        id: 'CF-0025',
        whyNot: 'Once the cause was clear the fix took 30 minutes. The restart did not help and made things worse.',
      },
      { id: 'CF-0004', whyNot: 'No migration was running; the column had always been this size.' },
    ],
    explanation:
      'A view counter stored in a 32-bit column reached its largest possible value, so writes failed. The restart looked like the obvious fix, but it sent every worker back into the same failing write and made the whole service slower.',
  },
  {
    id: 'dispatch-failover',
    title: 'The Hand-Built Trip Log',
    clues: [
      '07:48 Ride requests fail for about two minutes, then recover. Drivers say recent trips are missing from their history.',
      '07:52 The main database host went offline at 07:46 with a disk error. Failover finished in 90 seconds and the app is serving normally.',
      '10:30 The replica that took over was about four minutes behind, so trips from that window are gone. Engineers rebuild them by hand from payment and GPS logs. The job runs until 16:00.',
    ],
    factors: ['CF-0035', 'CF-0009', 'CF-0025'],
    decoys: [
      {
        id: 'CF-0012',
        whyNot: 'The failover worked and the service stayed healthy. The problem was the data the new primary held.',
      },
      {
        id: 'CF-0008',
        whyNot: 'No cache was involved. The missing data was on a promoted database replica, which has its own card.',
      },
    ],
    explanation:
      'A disk failure took the main database host down. Failover promoted a replica that was a few minutes behind, so recent trips were missing. Rebuilding them was manual work that took hours.',
  },
  {
    id: 'renamed-column',
    title: 'The Renamed Column',
    clues: [
      '03:10 Invoice emails stop going out. The web app looks fine for customers.',
      "03:25 The invoice job logs 'column not found: plan_code'. A planned migration at 03:00 renamed plan_code to plan_id and dropped the old column.",
      '04:00 The migration is reverted and the job runs again. 50,000 invoices queued during the outage take until 09:30 to send, so customers get late invoices all morning.',
    ],
    factors: ['CF-0004', 'CF-0024'],
    decoys: [
      { id: 'CF-0002', whyNot: 'No release shipped. The application code did not change.' },
      { id: 'CF-0005', whyNot: 'Every row was ordinary. The column the code read was gone.' },
      {
        id: 'CF-0012',
        whyNot: 'The revert worked and the job resumed at once. The later delay was the queue draining.',
      },
    ],
    explanation:
      'A migration renamed and dropped a column that the invoice job still read. After the revert, the job had a large queue to work through, so invoices stayed late for hours.',
  },
  {
    id: 'disk-guard',
    title: 'The Helpful Janitor',
    clues: [
      '13:05 Dashboards and scheduled exports fail across the analytics platform. Nothing was deployed today.',
      '13:12 Shared storage was 91% full. A guard script that deletes the oldest files whenever disk passes 90% ran at 13:00.',
      '13:30 The oldest files included the working folders of three long jobs that were still reading them. Storage is at 62% now, and those jobs have crashed.',
    ],
    factors: ['CF-0026', 'CF-0007'],
    decoys: [
      { id: 'CF-0019', whyNot: 'The disk never filled up. The guard acted at 90%, before the limit.' },
      { id: 'CF-0035', whyNot: 'The disks were healthy. Space was freed on purpose, by deletion.' },
      { id: 'CF-0002', whyNot: 'Nothing was released. The guard script had run quietly for a year.' },
    ],
    explanation:
      'A protective script meant to keep the disk from filling up deleted files to stay under its threshold. Some of those files were in use, so jobs crashed. The protection caused the outage.',
  },
  {
    id: 'launch-lobby',
    title: 'Launch Day Lobby',
    clues: [
      "20:00 The game launches. Players can't buy the launch bundle and can't find matches. Support files it all as one ticket: 'launch is broken'.",
      '20:12 The team spends 40 minutes chasing one suspected cause. The logs show two different errors: purchase calls time out, and match requests from Europe cannot connect.',
      "20:55 The payment provider's status page shows degraded purchases since 19:58. Separately, a carrier link to the European data center is at 20% of its normal capacity.",
    ],
    factors: ['CF-0033', 'CF-0030', 'CF-0037'],
    decoys: [
      {
        id: 'CF-0028',
        whyNot: 'The payment system belongs to an outside provider, not to another team in the company.',
      },
      { id: 'CF-0015', whyNot: 'Servers peaked at 35% of capacity. The failures were timeouts and a thin link.' },
    ],
    explanation:
      'Two unrelated faults arrived together: an outside payment provider degraded, and a network link to Europe lost most of its capacity. Both showed up as launch problems, so the team treated them as one and lost time on the wrong cause.',
  },
  {
    id: 'everyone-waiting',
    title: 'Everyone Waiting',
    clues: [
      '18:30 The mobile app hangs on the home screen for most users. Servers are up and request volume is normal.',
      '18:36 Every API worker is busy, and each one is waiting on the profile service. Database CPU is at 12%.',
      '18:44 The profile service, run by another team inside the company, has been down since 18:27. Requests wait on it in the shared worker pool until no worker is free, so even screens that never need profiles hang.',
    ],
    factors: ['CF-0028', 'CF-0016'],
    decoys: [
      { id: 'CF-0018', whyNot: 'Database CPU was 12% and no expensive queries were running.' },
      { id: 'CF-0033', whyNot: 'The profile service belongs to another internal team, not an outside provider.' },
      { id: 'CF-0015', whyNot: 'Request volume was normal. Workers were stuck waiting, not too few for the load.' },
    ],
    explanation:
      "An internal service failed, and the API's shared worker pool filled with requests waiting on it until nothing else could be served. One broken dependency took down screens that never needed it.",
  },
  {
    id: 'quarter-end-report',
    title: 'The Quarter-End Report',
    clues: [
      '09:00 Course pages load slowly for teachers and students, then time out. Student traffic matches last Monday.',
      '09:07 Database CPU is pegged, mostly by three queries that each scan the entire grades table. The connection pool has plenty of free connections.',
      "09:20 The queries belong to the quarterly grade report, which the registrar's scheduled job started at 08:58 against the live database. Pausing the job drops CPU to 20% within a minute.",
    ],
    factors: ['CF-0018', 'CF-0023'],
    decoys: [
      {
        id: 'CF-0016',
        whyNot: 'The connection pool had free connections. A few heavy queries saturated the database; requests were not piling up.',
      },
      { id: 'CF-0015', whyNot: 'Student traffic matched last Monday.' },
      {
        id: 'CF-0038',
        whyNot: "The queries came from the registrar's own scheduler account. The audit log shows no outside access.",
      },
    ],
    explanation:
      'Three heavy queries, each scanning the full grades table, kept the database busy. They came from a scheduled report job that ran against the live database while students were using it.',
  },
  {
    id: 'power-out',
    title: 'Lights Out in Hall B',
    clues: [
      '19:40 The live stream drops for viewers on the west coast. Other regions are fine.',
      '19:44 Every host in one data hall is unreachable. The building lost utility power at 19:38 and the backup generator did not start.',
      '19:52 Traffic moves to the east region, whose caches are empty. Its origin servers run at maximum load for 25 minutes until the caches fill, and viewers see buffering.',
    ],
    factors: ['CF-0034', 'CF-0022'],
    decoys: [
      { id: 'CF-0035', whyNot: 'The hosts were healthy. They were off because the building lost power.' },
      { id: 'CF-0030', whyNot: 'Outside the hall the network was fine. Everything inside lost power.' },
    ],
    explanation:
      'The building lost power and its generator did not start, taking down a whole data hall. Moving viewers to another region sent full load to caches that were still empty.',
  },
  {
    id: 'account-hold',
    title: 'Account on Hold',
    clues: [
      "11:00 A marketplace's card payments all fail at once. Our own pages and APIs are fine.",
      "11:08 The payment processor answers every request quickly with a 'merchant on hold' code. Our dashboard counts any HTTP 200 as a success, so it shows 100% green.",
      '11:50 The card network put our merchant account under review after unusual refund levels. The processor cannot lift the hold until the review ends, which takes two days.',
    ],
    factors: ['CF-0036', 'CF-0011'],
    decoys: [
      { id: 'CF-0033', whyNot: 'The processor was up and answering fast. It was following a hold, not failing.' },
      { id: 'CF-0027', whyNot: 'Our API credentials were valid. The processor named the hold in its reply.' },
      { id: 'CF-0002', whyNot: 'Nothing shipped. Every payment began failing at the same moment, 11:00.' },
    ],
    explanation:
      'An outside authority put the merchant account on hold, so every payment was refused on purpose. Our dashboard counted fast refusals as successes, so it reported normal.',
  },
  {
    id: 'strange-workers',
    title: 'Strange Workers',
    clues: [
      '02:10 Memory alarms fire on most hosts in the batch cluster. Hosts start restarting.',
      '02:25 The memory is full of processes nobody recognizes, launched on every host. No scheduled job or release accounts for them.',
      '02:50 The audit log shows a cloud access key from a former contractor used from an unfamiliar address at 01:55 to start the processes. The key had not expired. It was never revoked.',
    ],
    factors: ['CF-0038', 'CF-0017'],
    decoys: [
      { id: 'CF-0023', whyNot: 'None of our scheduled or background jobs started these processes.' },
      { id: 'CF-0027', whyNot: 'The key had not expired. That is why it still worked.' },
      { id: 'CF-0014', whyNot: 'Memory was high on every host, not concentrated on one.' },
    ],
    explanation:
      "Someone used a leftover access key to launch their own processes on the cluster. Those processes filled the hosts' memory and forced restarts.",
  },
  {
    id: 'short-ttl',
    title: 'The Short TTL',
    clues: [
      "11:05 The mobile app says 'cannot connect' for about a third of users. API servers are healthy.",
      '11:12 Lookups for the API address sometimes return no answer. The DNS resolvers are seeing 40 times their normal query rate.',
      '11:20 At 11:00 the team cut the API record time-to-live from 1 hour to 30 seconds, planning for faster failover. Phones now look up the address constantly, and the resolvers cannot keep up.',
    ],
    factors: ['CF-0031', 'CF-0003'],
    decoys: [
      { id: 'CF-0002', whyNot: 'No software was released. The change was a DNS setting.' },
      {
        id: 'CF-0001',
        whyNot: 'The change touched only the API records it was meant to. The surprise was how many lookups it caused.',
      },
      { id: 'CF-0030', whyNot: 'The network was fine. Connecting by IP address worked.' },
    ],
    explanation:
      'A planned DNS setting change made every phone ask for the address far more often. The resolvers could not keep up and began returning no answers. Nobody expected the change to affect load.',
  },
  {
    id: 'doorbuster',
    title: 'Doorbuster',
    clues: [
      '06:00 The Black Friday sale opens. Checkout slows down within minutes, then starts timing out.',
      '06:10 Traffic is 8 times a normal day. The team planned for 3 times. All checkout servers are at full CPU.',
      '06:40 More servers are needed, but adding them means running a script by hand and approving each batch. Capacity does not double until 09:30.',
    ],
    factors: ['CF-0015', 'CF-0025'],
    decoys: [
      { id: 'CF-0020', whyNot: 'Demand did not climb over weeks. One sale day caused a one-day spike.' },
      { id: 'CF-0019', whyNot: 'No quota or cap was reached. The servers simply ran out of CPU.' },
    ],
    explanation:
      'A sale brought far more shoppers than the servers were sized for. Adding servers was a manual job, so checkout stayed slow for hours.',
  },
  {
    id: 'growing-pains',
    title: 'Growing Pains',
    clues: [
      '10:00 Report generation takes 40 seconds for many customers, up from 5 in the spring. Nothing was released this week.',
      '10:20 Average CPU on the report servers looks fine at 55%. In busy hours the slowest reports take over 30 seconds. The alert is set on the average.',
      "11:00 Signups have grown 15% a month since June. New servers arrive in small batches each quarter, sized for last quarter's traffic. Every month the busy hours get worse.",
    ],
    factors: ['CF-0020', 'CF-0011'],
    decoys: [
      { id: 'CF-0015', whyNot: 'There was no spike. Busy hours got steadily worse over months.' },
      { id: 'CF-0019', whyNot: 'No quota or cap was reached. There were simply too few servers.' },
      { id: 'CF-0023', whyNot: 'No batch job was running. The load was customers running their own reports.' },
    ],
    explanation:
      'Customers grew faster than capacity was added. The alert watched average CPU, which stayed normal while busy hours kept getting worse.',
  },
  {
    id: 'quota-day',
    title: 'Quota Day',
    clues: [
      "09:00 Builds queue for 40 minutes on the engineering team's build platform. Build volume is the same as any Monday.",
      '09:15 The autoscaler is stuck at 200 agents, the cloud account instance quota. 45 of them are idle leftovers from failed jobs.',
      '09:30 On-call restarts agents to shake things loose. Each one is terminated, and its replacement cannot start because instances still shutting down count against the quota. Capacity falls to 188 and the queue grows.',
    ],
    factors: ['CF-0019', 'CF-0012'],
    decoys: [
      { id: 'CF-0015', whyNot: 'Build volume was the same as any Monday. Idle leftovers filled the quota.' },
      { id: 'CF-0020', whyNot: 'There was no growth trend. The same volume ran fine last week.' },
    ],
    explanation:
      'The build platform hit its instance quota, partly filled by idle leftovers, so it could not add agents. A restart meant to help removed agents the quota would not let it replace, so capacity dropped further.',
  },
  {
    id: 'wrong-prices',
    title: 'Wrong Prices',
    clues: [
      '06:05 Customers report the grocery app showing 90% off nearly everything. Orders pour in.',
      '06:20 A discount rule meant for one clearance category was saved at 06:00 with the category field blank. A blank matches every product.',
      '06:45 The rule was corrected at 06:25, but the app keeps showing the wrong prices until 08:30. The product cache only refreshes when a product changes, not when a rule does.',
    ],
    factors: ['CF-0001', 'CF-0008'],
    decoys: [
      { id: 'CF-0002', whyNot: 'No code was released. A rule setting changed.' },
      {
        id: 'CF-0003',
        whyNot: 'The rule was entered with the wrong scope. A correctly scoped change that surprised people would be a different story.',
      },
      { id: 'CF-0022', whyNot: 'The cache was warm and answering. Its answers were wrong, not missing.' },
    ],
    explanation:
      'A discount meant for one category applied to every product. After the rule was fixed, cached prices stayed wrong for hours because the cache did not refresh when a rule changed.',
  },
]

export const incidents: Incident[] = [...seeds, ...newIncidents]
