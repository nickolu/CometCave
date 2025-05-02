"use client";

import { FantasyStoryEvent } from "../models/types";

export function StoryFeed({ events }: { events: FantasyStoryEvent[] }) {
  if (!events?.length) return (
    <div className="bg-gray-50 p-3 rounded text-gray-500 text-sm">No events yet.</div>
  );
  return (
    <div className="border rounded h-48 overflow-y-auto flex flex-col-reverse p-2 space-y-2 space-y-reverse">
      {events.slice().reverse().map((e) => (
        <div key={`${e.id}-${e.timestamp}`} className="border-b pb-1 mb-1 last:border-none last:mb-0">
          <span className="text-xs">{new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 16)}</span>
          <div className="text-sm">{e.description}</div>
          {e.resourceDelta && (e.resourceDelta.gold !== undefined || e.resourceDelta.reputation !== undefined || e.resourceDelta.distance !== undefined || e.resourceDelta.statusChange) && (
            <div className="text-xs mt-0.5">
              {[
                e.resourceDelta.gold !== undefined && e.resourceDelta.gold !== 0 ? `Gold ${e.resourceDelta.gold > 0 ? '+' : ''}${e.resourceDelta.gold}` : null,
                e.resourceDelta.reputation !== undefined && e.resourceDelta.reputation !== 0 ? `Reputation ${e.resourceDelta.reputation > 0 ? '+' : ''}${e.resourceDelta.reputation}` : null,
                e.resourceDelta.distance !== undefined && e.resourceDelta.distance !== 0 ? `Distance ${e.resourceDelta.distance > 0 ? '+' : ''}${e.resourceDelta.distance}` : null,
                e.resourceDelta.statusChange ? `Status: ${e.resourceDelta.statusChange}` : null,
              ].filter(Boolean).join(', ')}
            </div>
          )}
          {((e.resourceDelta && e.resourceDelta.rewardItems && e.resourceDelta.rewardItems.length > 0) || (e.rewardItems && e.rewardItems.length > 0)) && (
            <div className="text-xs mt-0.5 text-green-700">
              {((e.resourceDelta?.rewardItems || []).concat(e.rewardItems || [])).map((item, idx) => (
                <span key={item.id + idx}>
                  You received {item.quantity} <span className="font-mono">{item.id}</span>{' '}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
