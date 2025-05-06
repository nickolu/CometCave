"use client";
import React from "react";
import { motion } from "framer-motion";
import { FantasyCharacter } from "../models/types";

interface CharacterCardProps {
  character: FantasyCharacter;
  selected?: boolean;
  onSelect?: (character: FantasyCharacter) => void;
  onDelete?: (e: React.MouseEvent, id: string) => void;
}

export default function CharacterCard({ character, selected, onSelect, onDelete }: CharacterCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.04, boxShadow: "0 6px 24px rgba(0,0,0,0.18)" }}
      className={`relative flex flex-col items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer focus:outline-none select-none shadow-sm bg-gray-900 ${selected ? "ring-2 ring-green-400 border-green-400" : "border-gray-700 hover:bg-gray-800"}`}
      onClick={() => onSelect?.(character)}
      tabIndex={0}
    >
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-600 to-blue-700 flex items-center justify-center mb-2 border border-gray-700 text-white text-2xl font-bold">
        {character.name.slice(0,2).toUpperCase()}
      </div>
      <div className="text-white font-semibold text-base truncate w-full text-center">{character.name}</div>
      <div className="text-xs text-gray-400 mb-1">Lv.{character.level} {character.race} {character.class}</div>
      <div className="flex flex-wrap gap-2 text-xs text-gray-300 mt-1 justify-center">
        <span>Gold: {character.gold}</span>
        <span>Rep: {character.reputation}</span>
        <span>STR: {character.strength}</span>
        <span>INT: {character.intelligence}</span>
        <span>LUCK: {character.luck}</span>
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(e, character.id); }}
          className="absolute top-2 right-2 text-red-400 hover:text-red-600 focus:outline-none text-lg px-2"
          aria-label={`Delete ${character.name}`}
        >
          ×
        </button>
      )}
    </motion.div>
  );
}
