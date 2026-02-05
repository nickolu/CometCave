import { motion } from 'framer-motion'

export const TransitionWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      key="generate"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  )
}
