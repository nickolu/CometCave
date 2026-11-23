'use client'

import { useSyncExternalStore } from 'react'

import { emptyData, readData, recordRun, writeData } from './lib/storage'

import type { IncidentResult } from './lib/rules'
import type { PostmortemData } from './lib/storage'

// Same shape as Comet Cards' useRunHistory: a tiny external store over
// localStorage. getSnapshot must return a stable reference, so it is cached
// and only replaced when we write.
const EMPTY = emptyData()
let snapshot: PostmortemData = EMPTY
let loaded = false
let listeners: Array<() => void> = []

function getSnapshot(): PostmortemData {
  if (!loaded && typeof window !== 'undefined') {
    snapshot = readData()
    loaded = true
  }
  return snapshot
}

function getServerSnapshot(): PostmortemData {
  return EMPTY
}

function subscribe(listener: () => void) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

/** Saves a finished run. If storage is unavailable the data still lives in memory for this tab. */
export function saveFinishedRun(results: readonly IncidentResult[], score: number, dateIso: string): PostmortemData {
  const next = recordRun(getSnapshot(), results, score, dateIso)
  writeData(next)
  snapshot = next
  loaded = true
  listeners.forEach(l => l())
  return next
}

export function useStoredData(): PostmortemData {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function getStoredData(): PostmortemData {
  return getSnapshot()
}
