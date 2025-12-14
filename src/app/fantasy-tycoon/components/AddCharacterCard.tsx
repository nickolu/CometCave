'use client'
import React from 'react'
import { motion } from 'framer-motion'

interface AddCharacterCardProps {
  onClick: () => void
}

export default function AddCharacterCard({ onClick }: AddCharacterCardProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, boxShadow: '0 8px 28px rgba(0,0,0,0.25)' }}
      className="flex flex-col items-center justify-center p-4 rounded-lg border-2 border-dashed border-sky-500 bg-[#161723] text-sky-400 hover:bg-sky-500/10 hover:border-sky-400 transition-all cursor-pointer focus:outline-none min-h-[200px] shadow-lg"
      onClick={onClick}
      tabIndex={0}
      aria-label="Add Character"
      type="button"
    >
      <span className="text-5xl font-light mb-2">+</span>
      <span className="font-medium text-base">Add New Character</span>
    </motion.button>
  )
}
