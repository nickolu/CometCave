"use client";
import React from "react";
import { motion } from "framer-motion";

interface AddCharacterCardProps {
  onClick: () => void;
}

export default function AddCharacterCard({ onClick }: AddCharacterCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.06, boxShadow: "0 8px 28px rgba(0,0,0,0.22)" }}
      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-green-400 bg-gray-800 text-green-300 hover:bg-green-900/20 transition-all cursor-pointer focus:outline-none min-h-[120px]"
      onClick={onClick}
      tabIndex={0}
      aria-label="Add Character"
      type="button"
    >
      <span className="text-4xl font-bold mb-1">＋</span>
      <span className="font-medium text-base">Add Character</span>
    </motion.button>
  );
}
