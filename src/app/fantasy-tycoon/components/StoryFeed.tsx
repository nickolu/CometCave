'use client';

import { FantasyStoryEvent } from '../models/types';
import { useEffect, useRef, useState } from 'react';

export function StoryFeed({
  events,
  filterCharacterId,
}: {
  events: FantasyStoryEvent[];
  filterCharacterId?: string;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);

  const filteredEvents = events.filter(
    e => !filterCharacterId || e.characterId === filterCharacterId
  );

  const newestEvent = filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1] : null;
  const newestEventId = newestEvent ? newestEvent.id : null;

  useEffect(() => {
    if (newestEventId && feedRef.current) {
      const animationFrameId = requestAnimationFrame(() => {
        if (feedRef.current) {
          feedRef.current.scrollTo({ top: 0, behavior: 'auto' });
        }
      });

      setHighlightedEventId(newestEventId);
      const highlightTimer = setTimeout(() => {
        setHighlightedEventId(null);
      }, 2000);

      return () => {
        cancelAnimationFrame(animationFrameId);
        clearTimeout(highlightTimer);
      };
    } else {
    }
  }, [newestEventId]);

  if (!filteredEvents?.length)
    return <div className="bg-gray-50 p-3 rounded text-gray-500 text-sm">No events yet.</div>;

  return (
    <div
      ref={feedRef}
      className="border rounded max-h-[calc(100vh-479px)] rounded-lg overflow-y-auto flex p-2 space-y-2 flex-col"
    >
      {filteredEvents.reverse().map(e => (
        <div
          key={`${e.id}-${e.timestamp}`}
          className={`border-b pb-1 mb-1 first:border-none last:mb-0 transition-colors duration-300 ease-in-out ${
            highlightedEventId === e.id ? 'bg-blue-800 rounded-md p-1' : ''
          }`}
        >
          <span
            className={`text-xs text-align-right ${
              highlightedEventId === e.id ? 'text-gray-200' : 'text-gray-100'
            }`}
          >
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
                  <span
                    className={`text-sm ${
                      highlightedEventId === e.id
                        ? 'text-yellow-800 font-semibold'
                        : 'text-yellow-600'
                    }`}
                  >
                    {item.name}
                  </span>
                  ,{' '}
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
      <button
        onClick={() => {
          if (feedRef.current) {
            feedRef.current.scrollTo({ top: 0, behavior: 'auto' });
          }
        }}
      >
        Scroll to top
      </button>
    </div>
  );
}
