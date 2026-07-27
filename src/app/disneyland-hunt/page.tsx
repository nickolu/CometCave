'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Category = 'anywhere' | 'people' | 'snacks' | 'inline' | 'lands'
type FilterType = 'all' | 'anywhere' | 'people' | 'snacks' | 'inline' | 'lands'

interface Item {
  id: string
  text: string
  category: Category
  land?: string
  bonus?: number
  action?: boolean
}

const ITEMS: Item[] = [
  // Anywhere
  { id: 'a1',  text: 'A Hidden Mickey (3 circles!)', category: 'anywhere', bonus: 3 },
  { id: 'a2',  text: 'Someone wearing mouse ears', category: 'anywhere' },
  { id: 'a3',  text: 'A shiny balloon', category: 'anywhere' },
  { id: 'a4',  text: 'A bird hunting for crumbs', category: 'anywhere' },
  { id: 'a5',  text: 'A teeny-tiny door or window', category: 'anywhere' },
  { id: 'a6',  text: 'A fancy old-timey lamp', category: 'anywhere' },
  { id: 'a7',  text: 'Flowers planted in a shape', category: 'anywhere' },
  { id: 'a8',  text: 'Music playing from somewhere secret', category: 'anywhere' },
  { id: 'a9',  text: 'A trash can painted to match the land', category: 'anywhere' },
  { id: 'a10', text: 'A cast member sweeping with a big broom', category: 'anywhere' },
  { id: 'a11', text: 'A clock', category: 'anywhere' },
  { id: 'a12', text: 'A bell', category: 'anywhere' },
  { id: 'a13', text: 'A lantern', category: 'anywhere' },
  { id: 'a14', text: 'A wooden barrel', category: 'anywhere' },
  { id: 'a15', text: 'A mailbox', category: 'anywhere' },
  { id: 'a16', text: 'A big wagon wheel', category: 'anywhere' },
  { id: 'a17', text: 'A sign with fancy gold letters', category: 'anywhere' },
  { id: 'a18', text: 'An old key or padlock', category: 'anywhere' },
  { id: 'a19', text: 'Your reflection in something shiny', category: 'anywhere' },
  { id: 'a20', text: 'Something purple', category: 'anywhere' },
  { id: 'a21', text: 'A horse (real OR statue)', category: 'anywhere' },
  { id: 'a22', text: 'A weather vane on a roof', category: 'anywhere' },

  // People
  { id: 'p1',  text: 'A name tag from far, far away', category: 'people', bonus: 3 },
  { id: 'p2',  text: 'Someone wearing a birthday button', category: 'people' },
  { id: 'p3',  text: 'A family in matching shirts', category: 'people' },
  { id: 'p4',  text: 'Someone taking a selfie', category: 'people' },
  { id: 'p5',  text: 'A lanyard full of trading pins', category: 'people' },
  { id: 'p6',  text: 'Somebody fast asleep in a stroller', category: 'people' },
  { id: 'p7',  text: 'A kid dressed like royalty', category: 'people' },
  { id: 'p8',  text: 'A cast member who waves back at you', category: 'people' },
  { id: 'p9',  text: 'Someone with face paint', category: 'people' },
  { id: 'p10', text: 'A light-up toy or bubble wand', category: 'people' },
  { id: 'p11', text: 'Someone carrying a GIANT stuffed animal', category: 'people' },
  { id: 'p12', text: 'Two people dressed exactly the same', category: 'people' },
  { id: 'p13', text: 'A photographer with a big camera', category: 'people' },
  { id: 'p14', text: 'Someone doing a silly photo pose', category: 'people' },
  { id: 'p15', text: 'A grandma or grandpa wearing ears', category: 'people' },
  { id: 'p16', text: 'A hard-working helper dog', category: 'people' },
  { id: 'p17', text: 'Someone speaking a different language', category: 'people' },
  { id: 'p18', text: 'High-five a family member', category: 'people', action: true },

  // Snacks
  { id: 's1',  text: 'Someone eating a churro', category: 'snacks' },
  { id: 's2',  text: 'A popcorn cart', category: 'snacks' },
  { id: 's3',  text: 'A snack shaped like a mouse', category: 'snacks', bonus: 3 },
  { id: 's4',  text: 'A giant pretzel', category: 'snacks' },
  { id: 's5',  text: 'A lollipop bigger than your hand', category: 'snacks' },
  { id: 's6',  text: 'A turkey leg as big as your arm', category: 'snacks' },
  { id: 's7',  text: 'Cotton candy', category: 'snacks' },
  { id: 's8',  text: 'A swirly pineapple treat', category: 'snacks' },
  { id: 's9',  text: 'A giant corn dog', category: 'snacks' },
  { id: 's10', text: 'A popcorn bucket shaped like something', category: 'snacks' },
  { id: 's11', text: 'A candy apple decorated with a face', category: 'snacks' },
  { id: 's12', text: 'A fancy souvenir cup', category: 'snacks' },
  { id: 's13', text: 'Someone with a melty ice cream', category: 'snacks' },
  { id: 's14', text: 'Two people sharing one snack', category: 'snacks' },

  // In Line
  { id: 'q1',  text: 'A story detail hidden in the queue theming', category: 'inline' },
  { id: 'q2',  text: 'A working prop, mechanism, or animatronic in the queue', category: 'inline' },
  { id: 'q3',  text: 'A sign that\'s secretly funny if you read the fine print', category: 'inline' },
  { id: 'q4',  text: 'A date or number stamped on a prop', category: 'inline' },
  { id: 'q5',  text: 'A newspaper, letter, or document from the fictional world', category: 'inline' },
  { id: 'q6',  text: 'Something you can touch or interact with while waiting', category: 'inline' },
  { id: 'q7',  text: 'A nod to another Disney movie hidden in the queue', category: 'inline' },
  { id: 'q8',  text: 'A smell that perfectly matches the ride\'s theme', category: 'inline' },
  { id: 'q9',  text: 'A sound effect that makes the wait feel real', category: 'inline' },
  { id: 'q10', text: 'A "Staff Only" door that looks completely in-theme', category: 'inline' },
  { id: 'q11', text: 'A warning sign written in the ride\'s fictional rules', category: 'inline' },
  { id: 'q12', text: 'A Hidden Mickey somewhere in the queue', category: 'inline', bonus: 3 },
  { id: 'q13', text: 'A cobweb — real or fake? Can you tell?', category: 'inline' },
  { id: 'q14', text: 'A timeline, map, or diagram on the queue walls', category: 'inline' },
  { id: 'q15', text: 'Make a new friend in line — introduce yourself!', category: 'inline', action: true },

  // Lands — Main Street, U.S.A.
  { id: 'ms1', text: 'A horse-drawn vehicle on the street', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms2', text: 'The fire station (Engine Co. 1)', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms3', text: 'A window dedication above a shop', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms4', text: 'Ragtime piano or barbershop quartet music', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms5', text: 'The Emporium store window display', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms6',  text: "The lit windows above the firehouse — Walt's apartment tribute (lights always on)", category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms7',  text: 'Morse code playing on the telegraph at the train station (it\'s a real message)', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms8',  text: 'The dedication plaque on the train station arch', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms9',  text: 'A trolley track embedded in the road surface', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms10', text: 'The Harmony Barber Shop striped pole', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms11', text: '"Great Moments with Mr. Lincoln" playing inside the Opera House', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms12', text: 'A vintage penny arcade or coin-operated machine', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms13', text: 'The daily flag retreat ceremony at the flagpole', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms14', text: 'A window "business" name that\'s a hidden tribute or pun (read them all)', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms15', text: 'Gas-style lamp posts with round frosted globes', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms16', text: 'A rubbish bin with ornate painted Victorian details', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms17', text: 'The station master\'s office at the train depot', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms18', text: 'City Hall\'s formal entrance columns and flag', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms19', text: 'The center medallion in the road at the main hub', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms20', text: 'A vintage-style phone booth or old-fashioned telephone', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms21', text: 'A poster or placard for a fictional 1900s business or show', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms22', text: 'The Main Street Cinema (still has the silent film marquee)', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms23', text: 'A cast member in full Victorian-era costume', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms24', text: 'The Refreshment Corner — piano player performing live', category: 'lands', land: 'Main Street, U.S.A.' },
  { id: 'ms25', text: 'A fire hydrant painted to match the era (they\'re not modern)', category: 'lands', land: 'Main Street, U.S.A.' },

  // Lands — Adventureland
  { id: 'al1', text: 'A tiki totem or idol', category: 'lands', land: 'Adventureland' },
  { id: 'al2', text: 'Jungle Cruise boats loading or returning', category: 'lands', land: 'Adventureland' },
  { id: 'al3', text: 'Something made entirely of bamboo', category: 'lands', land: 'Adventureland' },
  { id: 'al4', text: 'A real or carved tropical bird', category: 'lands', land: 'Adventureland' },
  { id: 'al5', text: 'The Indiana Jones temple entrance arch', category: 'lands', land: 'Adventureland' },
  { id: 'al6',  text: 'A Jungle Cruise skipper landing a pun — wait for the punchline', category: 'lands', land: 'Adventureland' },
  { id: 'al7',  text: 'A shrunken head dangling inside the Jungle Cruise gift shop', category: 'lands', land: 'Adventureland' },
  { id: 'al8',  text: 'Tiki Room birds twitching and warming up before the show starts', category: 'lands', land: 'Adventureland' },
  { id: 'al9',  text: 'The Indiana Jones queue: a trigger rope you can pull (does something!)', category: 'lands', land: 'Adventureland' },
  { id: 'al10', text: 'A coded treasure map or mysterious journal in the Indy queue', category: 'lands', land: 'Adventureland' },
  { id: 'al11', text: 'A carved face on a tree stump or root', category: 'lands', land: 'Adventureland' },
  { id: 'al12', text: 'A lit tiki torch — gas flame, not electric', category: 'lands', land: 'Adventureland' },
  { id: 'al13', text: 'A handmade-looking sign in a fictional "native" language', category: 'lands', land: 'Adventureland' },
  { id: 'al14', text: 'Ropes strung between structures as a bridge or handrail', category: 'lands', land: 'Adventureland' },
  { id: 'al15', text: 'A giant clamshell used as a planter', category: 'lands', land: 'Adventureland' },
  { id: 'al16', text: 'The water-squirting tikis near the Enchanted Tiki Room entrance', category: 'lands', land: 'Adventureland' },
  { id: 'al17', text: 'A packing crate stamped with an exotic destination', category: 'lands', land: 'Adventureland' },
  { id: 'al18', text: 'An "authentic" explorer artifact or fossil mounted on the wall', category: 'lands', land: 'Adventureland' },
  { id: 'al19', text: 'Bamboo used as a load-bearing structural element', category: 'lands', land: 'Adventureland' },
  { id: 'al20', text: 'A poisonous-looking dart frog statue or carving', category: 'lands', land: 'Adventureland' },
  { id: 'al21', text: 'A warning sign for something silly or fictional', category: 'lands', land: 'Adventureland' },
  { id: 'al22', text: 'A real tropical plant you\'ve never seen before — ask a cast member what it is', category: 'lands', land: 'Adventureland' },
  { id: 'al23', text: 'The bayou waterway visible from the border with New Orleans Square', category: 'lands', land: 'Adventureland' },
  { id: 'al24', text: 'A Tiki Room bird whose beak moves even outside the show', category: 'lands', land: 'Adventureland' },
  { id: 'al25', text: 'An old ship anchor or rigging element near the waterway', category: 'lands', land: 'Adventureland' },

  // Lands — New Orleans Square
  { id: 'no1', text: 'A wrought-iron lace balcony', category: 'lands', land: 'New Orleans Square' },
  { id: 'no2', text: 'The Haunted Mansion facade', category: 'lands', land: 'New Orleans Square' },
  { id: 'no3', text: 'The Pirates of the Caribbean entrance', category: 'lands', land: 'New Orleans Square' },
  { id: 'no4', text: 'A street musician or live jazz sound', category: 'lands', land: 'New Orleans Square' },
  { id: 'no5', text: 'A beignet or Cajun-themed treat', category: 'lands', land: 'New Orleans Square' },
  { id: 'no6',  text: 'Club 33\'s secret door — gold "33" with an intercom buzzer', category: 'lands', land: 'New Orleans Square' },
  { id: 'no7',  text: "Madame Leota's tombstone in the graveyard — look closely, she blinks", category: 'lands', land: 'New Orleans Square' },
  { id: 'no8',  text: 'The Haunted Mansion pet cemetery tucked beside the building', category: 'lands', land: 'New Orleans Square' },
  { id: 'no9',  text: 'The "Beware of Hitchhiking Ghosts" sign on the Haunted Mansion fence', category: 'lands', land: 'New Orleans Square' },
  { id: 'no10', text: 'The Blue Bayou Restaurant — visible from the Pirates of the Caribbean queue', category: 'lands', land: 'New Orleans Square' },
  { id: 'no11', text: 'A skull-and-crossbones somewhere you didn\'t expect it', category: 'lands', land: 'New Orleans Square' },
  { id: 'no12', text: 'Street signs in French — Rue Royale, Rue de la Paix', category: 'lands', land: 'New Orleans Square' },
  { id: 'no13', text: 'A fleur-de-lis pattern on a gate or iron railing', category: 'lands', land: 'New Orleans Square' },
  { id: 'no14', text: 'Two wrought-iron balcony railings with completely different patterns', category: 'lands', land: 'New Orleans Square' },
  { id: 'no15', text: 'A gargoyle or grotesque face on the Haunted Mansion facade', category: 'lands', land: 'New Orleans Square' },
  { id: 'no16', text: 'A creepy crow or raven perched on something near the Haunted Mansion', category: 'lands', land: 'New Orleans Square' },
  { id: 'no17', text: 'A treasure map or old chart framed on a wall', category: 'lands', land: 'New Orleans Square' },
  { id: 'no18', text: 'An old wanted poster from a "pirate" world', category: 'lands', land: 'New Orleans Square' },
  { id: 'no19', text: 'A jazz trumpet or trombone incorporated into a building\'s decoration', category: 'lands', land: 'New Orleans Square' },
  { id: 'no20', text: 'The entire street with zero modern signage visible — spot the illusion', category: 'lands', land: 'New Orleans Square' },
  { id: 'no21', text: 'A ghost-shaped or skull-shaped design worked into an iron fence', category: 'lands', land: 'New Orleans Square' },
  { id: 'no22', text: 'The stretching portrait gallery visible through the Haunted Mansion windows', category: 'lands', land: 'New Orleans Square' },
  { id: 'no23', text: 'A pirate "trick" or visual gag somewhere in the Pirates loading area', category: 'lands', land: 'New Orleans Square' },
  { id: 'no24', text: 'The old-style gas lamp casting a warm yellow glow on the cobblestones', category: 'lands', land: 'New Orleans Square' },
  { id: 'no25', text: 'A mardi gras bead, mask, or festive decoration woven into the theming', category: 'lands', land: 'New Orleans Square' },

  // Lands — Frontierland
  { id: 'fr1', text: 'The Mark Twain Riverboat (or Columbia sailing ship)', category: 'lands', land: 'Frontierland' },
  { id: 'fr2', text: 'Big Thunder Mountain — point at the very peak!', category: 'lands', land: 'Frontierland' },
  { id: 'fr3', text: 'A wanted poster on a wall', category: 'lands', land: 'Frontierland' },
  { id: 'fr4', text: 'Something made of rope, leather, or rawhide', category: 'lands', land: 'Frontierland' },
  { id: 'fr5', text: 'A wagon or mine cart', category: 'lands', land: 'Frontierland' },
  { id: 'fr6',  text: 'The actual petrified tree — an ancient redwood fossil with a plaque', category: 'lands', land: 'Frontierland' },
  { id: 'fr7',  text: 'Tom Sawyer Island across the water — you can only reach it by raft', category: 'lands', land: 'Frontierland' },
  { id: 'fr8',  text: 'The Golden Horseshoe saloon with its longhorn skull above the stage', category: 'lands', land: 'Frontierland' },
  { id: 'fr9',  text: 'A live goat somewhere on Big Thunder Mountain', category: 'lands', land: 'Frontierland' },
  { id: 'fr10', text: 'Dinosaur bones embedded in the rockwork of Big Thunder Mountain', category: 'lands', land: 'Frontierland' },
  { id: 'fr11', text: 'The "bat cave" tunnel near Big Thunder\'s first lift hill', category: 'lands', land: 'Frontierland' },
  { id: 'fr12', text: 'The Rivers of America — name at least two different watercraft you can see', category: 'lands', land: 'Frontierland' },
  { id: 'fr13', text: 'The Columbia (3-masted tall ship) vs. the Mark Twain (paddle steamer) — spot both', category: 'lands', land: 'Frontierland' },
  { id: 'fr14', text: 'A shooting gallery target (bull\'s eye, can, or animal silhouette)', category: 'lands', land: 'Frontierland' },
  { id: 'fr15', text: 'A "Boot Hill" grave marker or cemetery stone in the landscape', category: 'lands', land: 'Frontierland' },
  { id: 'fr16', text: 'A geode or mining crystal on display in a shop window', category: 'lands', land: 'Frontierland' },
  { id: 'fr17', text: 'A barrel organ or player piano sound drifting from the saloon', category: 'lands', land: 'Frontierland' },
  { id: 'fr18', text: 'A wooden boardwalk section (listen for the hollow clunk underfoot)', category: 'lands', land: 'Frontierland' },
  { id: 'fr19', text: 'A hitching post ring bolted to a fence or wall', category: 'lands', land: 'Frontierland' },
  { id: 'fr20', text: 'A crate of DYNAMITE — Big Thunder is "the wildest ride in the wilderness"', category: 'lands', land: 'Frontierland' },
  { id: 'fr21', text: 'Authentic-looking Native American-inspired beadwork or art in a shop', category: 'lands', land: 'Frontierland' },
  { id: 'fr22', text: 'An old oil lamp or miner\'s lantern hanging overhead', category: 'lands', land: 'Frontierland' },
  { id: 'fr23', text: 'A fence section built from wagon wheel spokes or axles', category: 'lands', land: 'Frontierland' },
  { id: 'fr24', text: 'Fort Wilderness on Tom Sawyer Island — look for the stockade walls', category: 'lands', land: 'Frontierland' },
  { id: 'fr25', text: 'A fictional outlaw\'s wanted poster with a reward amount', category: 'lands', land: 'Frontierland' },

  // Lands — Fantasyland
  { id: 'fn1', text: 'Sleeping Beauty Castle from the inside courtyard', category: 'lands', land: 'Fantasyland' },
  { id: 'fn2', text: 'The Matterhorn — spot someone at the summit!', category: 'lands', land: 'Fantasyland' },
  { id: 'fn3', text: "It's a Small World clock tower", category: 'lands', land: 'Fantasyland' },
  { id: 'fn4', text: 'King Arthur Carrousel horses', category: 'lands', land: 'Fantasyland' },
  { id: 'fn5', text: 'Dumbo flying overhead', category: 'lands', land: 'Fantasyland' },
  { id: 'fn6',  text: 'The sword in the stone (Excalibur) — try to pull it!', category: 'lands', land: 'Fantasyland' },
  { id: 'fn7',  text: "Snow White's wishing well — toss a coin and listen for a response", category: 'lands', land: 'Fantasyland' },
  { id: 'fn8',  text: 'The Storybook Land Canal Boats — a miniature village scene floating past', category: 'lands', land: 'Fantasyland' },
  { id: 'fn9',  text: 'Casey Jr. Circus Train chugging around Storybook Land', category: 'lands', land: 'Fantasyland' },
  { id: 'fn10', text: 'The Mad Tea Party: a mouse peeking out of a teapot decoration', category: 'lands', land: 'Fantasyland' },
  { id: 'fn11', text: "Mr. Toad's Wild Ride: Toad Hall crest above the entrance", category: 'lands', land: 'Fantasyland' },
  { id: 'fn12', text: 'A Cheshire Cat grin hidden somewhere in the Alice in Wonderland area', category: 'lands', land: 'Fantasyland' },
  { id: 'fn13', text: "Pinocchio's Daring Journey: marionette strings above the entrance", category: 'lands', land: 'Fantasyland' },
  { id: 'fn14', text: "The Matterhorn Yeti's glowing red eyes visible inside the mountain", category: 'lands', land: 'Fantasyland' },
  { id: 'fn15', text: "King Arthur Carrousel: find Jingles — the white horse decorated with flowers (it's Cinderella's!)", category: 'lands', land: 'Fantasyland' },
  { id: 'fn16', text: "Count all the Dumbos flying on the ride — how many are there?", category: 'lands', land: 'Fantasyland' },
  { id: 'fn17', text: "Sleeping Beauty Castle's walk-through — a stained glass window or mosaic inside", category: 'lands', land: 'Fantasyland' },
  { id: 'fn18', text: "It's a Small World clock tower — watch for the dolls to parade on the hour", category: 'lands', land: 'Fantasyland' },
  { id: 'fn19', text: "Peter Pan's Flight: a shadow on the queue building", category: 'lands', land: 'Fantasyland' },
  { id: 'fn20', text: "The Bibbidi Bobbidi Boutique window — wands, tiaras, and transformation magic", category: 'lands', land: 'Fantasyland' },
  { id: 'fn21', text: 'A "Once Upon a Time" inscription worked into an arch or doorway', category: 'lands', land: 'Fantasyland' },
  { id: 'fn22', text: 'Matterhorn bobsleds launching from the loading dock', category: 'lands', land: 'Fantasyland' },
  { id: 'fn23', text: "A fairy tale coat of arms or heraldic shield worked into the stonework", category: 'lands', land: 'Fantasyland' },
  { id: 'fn24', text: "The castle's drawbridge and moat — is the bridge up or down?", category: 'lands', land: 'Fantasyland' },
  { id: 'fn25', text: 'Snow White\'s poisoned apple — a red apple worked into the queue or signage', category: 'lands', land: 'Fantasyland' },

  // Lands — Tomorrowland
  { id: 'tm1', text: 'Space Mountain (the full dome)', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm2', text: 'A rocket ship or spacecraft decoration', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm3', text: 'Something chrome, metallic, or shiny silver', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm4', text: 'Astro Orbitor rockets spinning overhead', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm5', text: 'A retro-futuristic font or logo', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm6',  text: 'The Observatron — the giant spinning kinetic sculpture at the land\'s entrance', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm7',  text: 'The PeopleMover passing through or around Space Mountain', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm8',  text: 'Finding Nemo Submarine Voyage — a yellow submarine below the waterline', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm9',  text: 'R2-D2 outside Star Tours — listen for his beeps', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm10', text: 'The Tomorrowland Speedway cars bumping along the track', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm11', text: 'A retro "atomic age" graphic or Space Age starburst symbol', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm12', text: 'The monorail passing overhead on its beam through Tomorrowland', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm13', text: "Star Wars Launch Bay: a real movie prop or screen-worn costume on display", category: 'lands', land: 'Tomorrowland' },
  { id: 'tm14', text: "The Tomorrowland entrance arch with its logo typography", category: 'lands', land: 'Tomorrowland' },
  { id: 'tm15', text: "A spacecraft or satellite model hanging from a ceiling inside a building", category: 'lands', land: 'Tomorrowland' },
  { id: 'tm16', text: 'A retro-futuristic poster advertising a fake "mission" or alien destination', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm17', text: 'The color palette of the whole land — mostly white, silver, and blue', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm18', text: "Something that looks like a 1950s prediction of what the future would look like", category: 'lands', land: 'Tomorrowland' },
  { id: 'tm19', text: 'Buzz Lightyear\'s Star Command crest on the building exterior', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm20', text: 'The PeopleMover loading platform — watch a tram glide away without stopping', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm21', text: 'A neon sign glowing in retro-futuristic style', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm22', text: 'A food item shaped like a rocket, planet, or space object', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm23', text: 'Two Stormtroopers patrolling together near Star Wars Launch Bay', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm24', text: 'A "mission control" style countdown screen or status monitor', category: 'lands', land: 'Tomorrowland' },
  { id: 'tm25', text: 'The submarine lagoon — look below the surface for sea life animations', category: 'lands', land: 'Tomorrowland' },

  // Lands — Mickey's Toontown
  { id: 'tt1', text: "Mickey's house (red with polka-dot accents)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt2', text: 'A wacky cartoon gadget or contraption', category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt3', text: "Minnie's house (it's pink!)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt4', text: 'A cartoon manhole cover with a character face', category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt5', text: "A building that looks like it's smiling or making a face", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt6',  text: "The First National Bank of Toontown — check the cartoon money details", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt7',  text: "Toontown City Hall — find the Mayor's name on the door", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt8',  text: "Gadget's Go Coaster — the whole thing is built from giant household objects", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt9',  text: "Roger Rabbit's Car Toon Spin: a Dip warning sign from Who Framed Roger Rabbit", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt10', text: "Chip 'n' Dale's Treehouse — tiny acorn and nut details inside", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt11', text: "An ACME company crate, box, or product (Wile E. Coyote's supplier)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt12', text: "A cartoon anvil somewhere — look up, it might be about to fall!", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt13', text: "A geyser or gag prop that goes off on its own — wait for it", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt14', text: "The talking mailbox — say something to it", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt15', text: "A fire hydrant that wiggles, squirts, or is otherwise non-standard", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt16', text: "A cartoon-shaped crack or splat in the pavement", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt17', text: "A sign with a joke or pun hidden in the fine print", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt18', text: "The Jolly Trolley tracks — the zigzag path through the middle of town", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt19', text: "A TNT plunger or bundle of dynamite as a joke prop", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt20', text: "Characters in 1920s-30s animation style painted somewhere (classic Mickey era)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt21', text: "Something made of giant everyday objects — a bolt, a pencil, an eraser", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt22', text: "A building that's squeezed, leaning, or defying gravity with cartoon physics", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt23', text: "Goofy's Playhouse — find the most slapstick item inside", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt24', text: "A newspaper headline framed on the wall (Toontown Gazette or Mickey Mouse News)", category: 'lands', land: "Mickey's Toontown" },
  { id: 'tt25', text: "A cartoon 'spring' coil sticking out of something for no reason", category: 'lands', land: "Mickey's Toontown" },

  // Lands — Star Wars: Galaxy's Edge
  { id: 'sw1', text: 'A First Order Stormtrooper on patrol', category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw2', text: "The Millennium Falcon — she's huge up close!", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw3', text: "An alien creature or species you can't name", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw4', text: "Blue or green milk from the market", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw5', text: "Aurebesh (Star Wars alphabet) written somewhere", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw6',  text: "Savi's Workshop — the building where guests hand-build lightsabers", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw7',  text: "Droid Depot — a droid rolling or beeping inside the building", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw8',  text: "Oga's Cantina — the DJ droid RX-24 spinning music behind the bar", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw9',  text: "The Black Spire itself — the ancient stone formation the outpost is named for", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw10', text: "A thermal detonator Coca-Cola bottle — it's a real product sold here", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw11', text: "A cast member who only speaks 'Batuuan' — ask them something and see what happens", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw12', text: "The Resistance X-wing parked under a rock overhang", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw13', text: "Dok-Ondar's Den of Antiquities — a bizarre alien artifact or lightsaber crystal for sale", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw14', text: "Aurebesh you can actually translate — look up a decoder and crack the message", category: 'lands', land: "Star Wars: Galaxy's Edge", bonus: 3 },
  { id: 'sw15', text: "A Probe Droid hanging from above — look UP in the market area", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw16', text: "A Wookiee other than Chewbacca (guest or cast)", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw17', text: "First Order propaganda posted on a wall or bulletin board", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw18', text: "The Resistance symbol (a phoenix/starburst) hidden somewhere", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw19', text: "Market stalls with alien food ingredients — something you can't identify", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw20', text: "Chewbacca interacting with a young child — notice how gentle he is", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw21', text: "A TIE fighter sound effect coming from overhead", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw22', text: "Kyber crystal display outside Savi's Workshop", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw23', text: "A Batuuan Spira coin on display (the in-universe currency of Batuu)", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw24', text: "The First Order shuttle or transport docked nearby", category: 'lands', land: "Star Wars: Galaxy's Edge" },
  { id: 'sw25', text: "Hydra plant — alien vegetation that looks like nothing on Earth", category: 'lands', land: "Star Wars: Galaxy's Edge" },
]

const LAND_ORDER = [
  'Main Street, U.S.A.',
  'Adventureland',
  'New Orleans Square',
  'Frontierland',
  'Fantasyland',
  'Tomorrowland',
  "Mickey's Toontown",
  "Star Wars: Galaxy's Edge",
]

const LAND_EMOJI: Record<string, string> = {
  'Main Street, U.S.A.': '🏛',
  'Adventureland': '🌴',
  'New Orleans Square': '🎷',
  'Frontierland': '🤠',
  'Fantasyland': '🏰',
  'Tomorrowland': '🚀',
  "Mickey's Toontown": '🎪',
  "Star Wars: Galaxy's Edge": '⚔️',
}

const STORAGE_KEY = 'dlhunt-checked'
const maxScore = ITEMS.reduce((sum, item) => sum + (item.bonus ?? 1), 0)

function getScore(checked: Set<string>): number {
  return ITEMS.reduce((sum, item) => checked.has(item.id) ? sum + (item.bonus ?? 1) : sum, 0)
}

function getCategoryCount(cat: Category, checked: Set<string>): number {
  return ITEMS.filter(i => i.category === cat && checked.has(i.id)).length
}

function getCategoryTotal(cat: Category): number {
  return ITEMS.filter(i => i.category === cat).length
}

function ItemRow({ item, isChecked, onToggle }: { item: Item; isChecked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isChecked ? 'rgba(0,255,194,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isChecked ? 'rgba(0,255,194,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        transition: 'background 0.15s',
        minHeight: 52,
      }}
    >
      {/* Checkbox circle */}
      <div style={{
        width: 22,
        height: 22,
        flexShrink: 0,
        borderRadius: '50%',
        border: `2px solid ${isChecked ? '#00ffc2' : 'rgba(255,255,255,0.2)'}`,
        background: isChecked ? '#00ffc2' : 'transparent',
        marginTop: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {isChecked && <span style={{ fontSize: 13, color: '#000', fontWeight: 'bold' }}>✓</span>}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 15,
          lineHeight: 1.4,
          color: isChecked ? 'rgba(255,255,255,0.35)' : '#e8e8f0',
          textDecoration: isChecked ? 'line-through' : 'none',
          fontStyle: item.action ? 'italic' : 'normal',
        }}>
          {item.action && <span style={{ color: '#ffd700' }}>✊ DO IT: </span>}
          {item.text}
        </div>
        {item.bonus && (
          <div style={{ color: '#ffd700', fontSize: 11, marginTop: 4 }}>
            {'⭐'.repeat(item.bonus)} +{item.bonus} pts
          </div>
        )}
      </div>
    </button>
  )
}

export default function DisneylandHuntPage() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<FilterType>('all')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setChecked(new Set(JSON.parse(raw)))
    } catch {}
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]))
    } catch {}
  }, [checked])

  const toggle = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const score = getScore(checked)
  const foundCount = checked.size
  const allDone = foundCount === ITEMS.length

  const tabs: { key: FilterType; label: string; emoji: string }[] = [
    { key: 'all',      label: 'All',      emoji: '' },
    { key: 'anywhere', label: 'Anywhere', emoji: '👀' },
    { key: 'people',   label: 'People',   emoji: '🧑' },
    { key: 'snacks',   label: 'Snacks',   emoji: '🍿' },
    { key: 'inline',   label: 'In Line',  emoji: '🎪' },
    { key: 'lands',    label: 'By Land',  emoji: '🗺' },
  ]

  const flatFiltered = filter === 'all' || filter === 'lands'
    ? ITEMS.filter(i => filter === 'all' || i.category === 'lands')
    : ITEMS.filter(i => i.category === filter)

  // For 'lands' view: group by land
  const landGroups: { land: string; items: Item[] }[] = filter === 'lands'
    ? LAND_ORDER.map(land => ({
        land,
        items: ITEMS.filter(i => i.land === land),
      }))
    : []

  return (
    <div style={{ minHeight: '100dvh', background: '#080810', color: '#e8e8f0', fontFamily: 'inherit' }}>

      {/* Sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(8,8,16,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, textDecoration: 'none' }}>
            ← Cave
          </Link>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>🎢 Scavenger Hunt</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{foundCount} / {ITEMS.length}</span>
        </div>
        <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.1)', marginTop: 8 }}>
          <div style={{
            width: `${(score / maxScore) * 100}%`,
            height: '100%', background: '#00ffc2', borderRadius: 2, transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 6 }}>
          Score: {score} / {maxScore} pts
        </div>
      </div>

      {/* Category tabs */}
      <div style={{
        position: 'sticky', top: 73, zIndex: 9,
        background: 'rgba(8,8,16,0.95)',
        padding: '10px 16px',
        display: 'flex', gap: 8,
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {tabs.map(tab => {
          const active = filter === tab.key
          let label = tab.emoji ? `${tab.emoji} ${tab.label}` : tab.label
          if (!active && tab.key !== 'all') {
            const cat = tab.key as Category
            const done = getCategoryCount(cat, checked)
            const total = getCategoryTotal(cat)
            label += ` (${done}/${total})`
          }
          return (
            <button key={tab.key} type="button" onClick={() => setFilter(tab.key)} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: '1px solid', whiteSpace: 'nowrap', transition: 'all 0.15s',
              background: active ? '#00ffc222' : 'transparent',
              borderColor: active ? '#00ffc2' : 'rgba(255,255,255,0.15)',
              color: active ? '#00ffc2' : 'rgba(255,255,255,0.5)',
            }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* Item list */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 600, margin: '0 auto' }}>

        {allDone && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(0,255,194,0.12), rgba(255,215,0,0.08))',
            border: '1px solid rgba(0,255,194,0.3)',
            borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 20, fontWeight: 'bold', color: '#00ffc2' }}>🎉 You found everything!</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
              Score: {score} / {maxScore} pts — legendary explorer!
            </div>
          </div>
        )}

        {filter === 'lands' ? (
          landGroups.map(({ land, items }) => {
            const landDone = items.filter(i => checked.has(i.id)).length
            return (
              <div key={land} style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 4px 6px',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                  marginBottom: 6,
                }}>
                  <span style={{ fontSize: 16 }}>{LAND_EMOJI[land] ?? '📍'}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1 }}>{land}</span>
                  <span style={{ fontSize: 11, color: landDone === items.length ? '#00ffc2' : 'rgba(255,255,255,0.35)', letterSpacing: 1 }}>
                    {landDone}/{items.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map(item => (
                    <ItemRow key={item.id} item={item} isChecked={checked.has(item.id)} onToggle={() => toggle(item.id)} />
                  ))}
                </div>
              </div>
            )
          })
        ) : (
          flatFiltered.map(item => (
            <ItemRow key={item.id} item={item} isChecked={checked.has(item.id)} onToggle={() => toggle(item.id)} />
          ))
        )}
      </div>

      {/* Reset */}
      <div style={{ padding: '24px 16px', textAlign: 'center' }}>
        <button type="button" onClick={() => { setChecked(new Set()); try { localStorage.removeItem(STORAGE_KEY) } catch {} }}
          style={{
            padding: '8px 20px', fontSize: 12,
            color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, background: 'transparent', cursor: 'pointer', letterSpacing: 1,
          }}>
          Reset hunt
        </button>
      </div>
    </div>
  )
}
