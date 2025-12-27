import { Button } from '@/components/ui/button'

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute top-0 left-0 w-full p-12 bg-black/90 flex flex-col items-center justify-center p-4 rounded-l-lg border-2 border-space-white z-50">
      <div className="flex justify-end w-full -mt-10 -mr-10">
        <Button onClick={onClose}>Close</Button>
      </div>
      {children}
    </div>
  )
}
