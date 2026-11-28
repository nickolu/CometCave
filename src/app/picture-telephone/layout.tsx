import './picture-telephone.css'

// The route is immersive (see IMMERSIVE_ROUTES in src/components/layout-shell.tsx):
// the game owns the whole window and carries its own door back to the cave,
// which lives in PictureTelephoneApp so it can ask before leaving a game in progress.
export default function PictureTelephoneLayout({ children }: { children: React.ReactNode }) {
  return <div className="pt-shell">{children}</div>
}
