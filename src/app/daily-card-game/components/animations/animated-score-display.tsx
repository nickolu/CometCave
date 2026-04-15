'use client'

import { AnimatePresence, motion } from 'framer-motion'

interface AnimatedScoreDisplayProps {
  chips: number
  mult: number
}

const slideVariants = {
  initial: { y: -12, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 12, opacity: 0 },
}

export function AnimatedScoreDisplay({ chips, mult }: AnimatedScoreDisplayProps) {
  return (
    <div>
      <strong>Chips x Mult:</strong>{' '}
      <span className="inline-flex items-center gap-1">
        <span className="text-blue-300 inline-block overflow-hidden align-middle">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={chips}
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className="inline-block"
            >
              {chips}
            </motion.span>
          </AnimatePresence>
        </span>
        <span> x </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={mult}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="inline-block text-orange-400 animate-combo-pulse"
          >
            {mult}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  )
}
