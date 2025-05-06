'use client';

import { FantasyStoryEvent } from '../models/types';

export function StoryFeed({
  events,
  filterCharacterId,
}: {
  events: FantasyStoryEvent[];
  filterCharacterId?: string;
}) {
  const filteredEvents = events.filter(
    e => !filterCharacterId || e.characterId === filterCharacterId
  );

  if (!filteredEvents?.length)
    return <div className="bg-gray-50 p-3 rounded text-gray-500 text-sm">No events yet.</div>;

  return (
    <div className="border rounded max-h-[calc(100vh-479px)] rounded-lg overflow-y-auto flex flex-col-reverse p-2 space-y-2 space-y-reverse">
      {filteredEvents.map(e => (
        <div
          key={`${e.id}-${e.timestamp}`}
          className="border-b pb-1 mb-1 first:border-none last:mb-0"
        >
          <span className="text-xs text-gray-500 text-align-right">
            {new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 16)}
          </span>
          <div className="text-sm">{e.description}</div>

          {((e.resourceDelta &&
            e.resourceDelta.rewardItems &&
            e.resourceDelta.rewardItems.length > 0) ||
            (e.rewardItems && e.rewardItems.length > 0)) && (
            <div className="text-sm mt-0.5 text-green-700">
              {(e.resourceDelta?.rewardItems || []).concat(e.rewardItems || []).map((item, idx) => (
                <span key={item.id + idx}>
                  You received {item.quantity > 1 ? `${item.quantity} ` : ''}
                  <span className="text-yellow-600 text-sm">{item.name}</span>,{' '}
                  {e.resourceDelta &&
                    (e.resourceDelta.gold !== undefined ||
                      e.resourceDelta.reputation !== undefined ||
                      e.resourceDelta.distance !== undefined ||
                      e.resourceDelta.statusChange) && (
                      <span className="text-sm mt-1">
                        {[
                          e.resourceDelta.gold !== undefined && e.resourceDelta.gold !== 0
                            ? `Gold ${e.resourceDelta.gold > 0 ? '+' : ''}${e.resourceDelta.gold}`
                            : null,
                          e.resourceDelta.reputation !== undefined &&
                          e.resourceDelta.reputation !== 0
                            ? `Reputation ${e.resourceDelta.reputation > 0 ? '+' : ''}${e.resourceDelta.reputation}`
                            : null,
                          e.resourceDelta.distance !== undefined && e.resourceDelta.distance !== 0
                            ? `Distance ${e.resourceDelta.distance > 0 ? '+' : ''}${e.resourceDelta.distance}`
                            : null,
                          e.resourceDelta.statusChange
                            ? `Status: ${e.resourceDelta.statusChange}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </span>
                    )}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
