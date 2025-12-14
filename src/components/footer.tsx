import Link from 'next/link'

export function Footer() {
  return (
    <footer className="border-t border-space-purple/20 mt-auto py-6 z-10 relative">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-slate-400 text-sm">© {new Date().getFullYear()} CometCave.com </div>
          <div className="flex gap-6">
            <Link
              href="#"
              className="text-slate-400 hover:text-cream-white text-sm transition-colors"
            >
              About
            </Link>
            <Link
              href="#"
              className="text-slate-400 hover:text-cream-white text-sm transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="#"
              className="text-slate-400 hover:text-cream-white text-sm transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
