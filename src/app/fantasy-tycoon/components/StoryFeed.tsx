"use client";

import { FantasyStoryEvent } from "../models/story";

export default function StoryFeed({ events }: { events: FantasyStoryEvent[] }) {
  if (!events?.length) return (
    <div className="bg-gray-50 p-3 rounded text-gray-500 text-sm">No events yet.</div>
  );
  return (
    <div className="bg-white border rounded h-48 overflow-y-auto flex flex-col-reverse p-2 space-y-2 space-y-reverse">
      {events.slice().reverse().map((e) => (
        <div key={e.id} className="border-b pb-1 mb-1 last:border-none last:mb-0">
          <span className="text-xs text-gray-400">{new Date(e.timestamp).toISOString().replace('T', ' ').slice(0, 16)}</span>
          <div className="text-sm">{e.description}</div>
        </div>
      ))}
    </div>
  );
}
