"use client";
import { useMemo } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/app/components/ui/tooltip";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { FantasyCharacter } from "../models/character";

type IconType = 'gold' | 'reputation' | 'distance' | 'level' | 'strength' | 'intelligence' | 'luck';

const ICONS: Record<IconType, React.ReactNode> = {
  gold: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#FFD700" stroke="#bfa100" strokeWidth="2" /></svg>
  ),
  reputation: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><rect x="4" y="4" width="12" height="12" rx="3" fill="#7dd3fc" stroke="#0369a1" strokeWidth="2" /></svg>
  ),
  distance: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M4 16L16 4" stroke="#22c55e" strokeWidth="2" /><circle cx="4" cy="16" r="2" fill="#22c55e" /><circle cx="16" cy="4" r="2" fill="#22c55e" /></svg>
  ),
  level: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><polygon points="10,2 15,18 5,18" fill="#fbbf24" stroke="#b45309" strokeWidth="2" /></svg>
  ),
  strength: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><rect x="6" y="6" width="8" height="8" rx="2" fill="#f87171" stroke="#b91c1c" strokeWidth="2" /></svg>
  ),
  intelligence: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7" ry="8" fill="#818cf8" stroke="#3730a3" strokeWidth="2" /></svg>
  ),
  luck: (
    <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="#a3e635" stroke="#365314" strokeWidth="2" /><text x="10" y="15" textAnchor="middle" fontSize="10" fill="#365314">★</text></svg>
  ),
} as const;

const STAT_LABELS: Record<IconType, string> = {
  gold: "Gold",
  reputation: "Reputation",
  distance: "Distance Travelled",
  level: "Level",
  strength: "Strength",
  intelligence: "Intelligence",
  luck: "Luck",
} as const;

const MAIN_STATS: IconType[] = ["gold", "reputation", "distance", "level"];
const EXTRA_STATS: IconType[] = ["strength", "intelligence", "luck"];

export function HudBar() {
  const { gameState } = useGameStore();
  const character = gameState?.characters?.find((char: FantasyCharacter) => char.id === gameState?.selectedCharacterId);

  const stats = useMemo(() => ({
    gold: character?.gold ?? 0,
    reputation: character?.reputation ?? 0,
    distance: character?.distance ?? 0,
    level: character?.level ?? 1,
    strength: character?.strength ?? 0,
    intelligence: character?.intelligence ?? 0,
    luck: character?.luck ?? 0,
  }), [character]) as Record<IconType, number>;

  // Responsive: show extra stats in dropdown on mobile
  return (
    <TooltipProvider>
    <div className="w-full flex items-center gap-4 px-2 py-1 rounded-lg shadow-md border border-gray-500">
      {MAIN_STATS.map((key) => (
        <Tooltip key={key}>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-sm font-semibold">
              <span className="inline-block align-middle">{ICONS[key]}</span>
              <span>{stats[key]}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {STAT_LABELS[key]}
          </TooltipContent>
        </Tooltip>
      ))}
      <div className="relative ml-auto">
        <details className="group sm:hidden">
          <summary className="flex items-center gap-1 cursor-pointer select-none text-xs text-gray-300 px-2 py-1 rounded hover:bg-gray-800">
            <InformationCircleIcon className="w-5 h-5 inline-block" />
            <span>More</span>
          </summary>
          <div className="absolute left-0 mt-2 z-10 min-w-[160px] bg-gray-900 border border-gray-700 rounded shadow-lg p-2">
            {EXTRA_STATS.map((key) => (
              <Tooltip key={key}>
                <TooltipTrigger>
                  <div className="flex items-center gap-1 text-sm font-semibold py-1">
                  <span className="inline-block align-middle">{ICONS[key]}</span>
                  <span>{stats[key]}</span>
                </div>
                </TooltipTrigger>
                <TooltipContent>
                  {STAT_LABELS[key]}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </details>
        <div className="hidden sm:flex gap-4">
          {EXTRA_STATS.map((key: IconType) => (
            <Tooltip key={key}>
              <TooltipTrigger>
                <div className="flex items-center gap-1 text-sm font-semibold">
                  <span className="inline-block align-middle">{ICONS[key]}</span>
                  <span>{stats[key]}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {STAT_LABELS[key]}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

