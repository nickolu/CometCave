import Link from 'next/link'

import { BrandMark } from '@/components/brand-mark'

export function Footer() {
  return (
    <footer className="mt-auto z-10 relative bg-surface-container-lowest rounded-t-[3rem] border-t border-t-white/5 py-12 px-8">
      <div className="mx-auto max-w-7xl flex flex-col items-center gap-6">
        <BrandMark size="sm" />

        <div className="flex gap-6">
          <Link
            href="#"
            className="text-on-surface-variant hover:text-on-surface text-sm transition-colors"
          >
            About
          </Link>
          <Link
            href="#"
            className="text-on-surface-variant hover:text-on-surface text-sm transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="#"
            className="text-on-surface-variant hover:text-on-surface text-sm transition-colors"
          >
            Contact
          </Link>
        </div>

        <div className="text-on-surface-variant/60 text-xs">
          © {new Date().getFullYear()} CometCave.com
        </div>
      </div>
    </footer>
  )
}
