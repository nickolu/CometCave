import { Navigation } from './Navigation'

export const PageTemplate = ({
  children,
  pageId,
}: {
  children: React.ReactNode
  pageId: string
}) => {
  return (
    <div>
      <div className="mb-4">
        <Navigation pageId={pageId} />
      </div>
      <div className="pt-4">{children}</div>
    </div>
  )
}
