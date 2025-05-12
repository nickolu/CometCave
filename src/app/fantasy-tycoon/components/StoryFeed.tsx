'use client';

import { FantasyStoryEvent } from '../models/types';
import { useEffect, useRef, useState } from 'react';

interface ResourceDeltaDisplayProps {
  resourceDelta: FantasyStoryEvent['resourceDelta'];
  isHighlighted: boolean;
}

function ResourceDeltaDisplay({ resourceDelta }: ResourceDeltaDisplayProps) {
  if (!resourceDelta) return null;

  const getValueColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-100';
  };

  const changes = [
    resourceDelta.gold !== undefined && resourceDelta.gold !== 0 ? (
      <span key="gold" className={getValueColor(resourceDelta.gold)}>
        Gold {resourceDelta.gold > 0 ? '+' : ''}
        {resourceDelta.gold}
      </span>
    ) : null,
    resourceDelta.reputation !== undefined && resourceDelta.reputation !== 0 ? (
      <span key="reputation" className={getValueColor(resourceDelta.reputation)}>
        Reputation {resourceDelta.reputation > 0 ? '+' : ''}
        {resourceDelta.reputation}
      </span>
    ) : null,
    resourceDelta.distance !== undefined && resourceDelta.distance !== 0 ? (
      <span key="distance" className={getValueColor(resourceDelta.distance)}>
        Distance {resourceDelta.distance > 0 ? '+' : ''}
        {resourceDelta.distance}
      </span>
    ) : null,
    resourceDelta.statusChange ? (
      <span key="status" className="text-gray-100">
        Status: {resourceDelta.statusChange}
      </span>
    ) : null,
  ].filter(Boolean);

  if (changes.length === 0) return null;

  return <div className="text-sm mt-0.5 flex flex-wrap gap-2">{changes}</div>;
}

interface RewardItemDisplayProps {
  item: { id: string; name: string; quantity: number };
  isHighlighted: boolean;
}

function RewardItemDisplay({ item, isHighlighted }: RewardItemDisplayProps) {
  return (
    <span>
      You received {item.quantity > 1 ? `${item.quantity} ` : ''}
      <span
        className={`text-sm ${isHighlighted ? 'text-yellow-800 font-semibold' : 'text-yellow-600'}`}
      >
        {item.name}
      </span>
    </span>
  );
}

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
    }
  }, [newestEventId]);

  if (!filteredEvents?.length) {
    return <div className="bg-gray-50 p-3 rounded text-gray-500 text-sm">No events yet.</div>;
  }

  return (
    <div
      ref={feedRef}
      className="border rounded max-h-[calc(100vh-479px)] rounded-lg overflow-y-auto flex p-2 space-y-2 flex-col"
    >
      {filteredEvents.reverse().map(e => {
        const isHighlighted = highlightedEventId === e.id;
        const allRewardItems = [...(e.resourceDelta?.rewardItems || []), ...(e.rewardItems || [])];

        return (
          <div
            key={`${e.id}-${e.timestamp}`}
            className={`border-b pb-1 mb-1 first:border-none last:mb-0 transition-colors duration-300 ease-in-out ${
              isHighlighted ? 'bg-blue-800 rounded-md p-1' : ''
            }`}
          >
            <span
              className={`text-xs text-align-right ${isHighlighted ? 'text-gray-200' : 'text-gray-100'}`}
            >
              {new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 16)}
            </span>
            <div className="text-sm">{e.description}</div>

            {allRewardItems.length > 0 && (
              <div className="text-sm mt-0.5 text-green-700">
                {allRewardItems.map((item, idx) => (
                  <div key={item.id + idx}>
                    <RewardItemDisplay item={item} isHighlighted={isHighlighted} />
                  </div>
                ))}
              </div>
            )}

            {e.resourceDelta && (
              <ResourceDeltaDisplay resourceDelta={e.resourceDelta} isHighlighted={isHighlighted} />
            )}
          </div>
        );
      })}
      <button
        onClick={() => {
          if (feedRef.current) {
            feedRef.current.scrollTo({ top: 0, behavior: 'auto' });
          }
        }}
        className="text-sm text-blue-600 hover:text-blue-800"
      >
        Scroll to top
      </button>
    </div>
  );
}
