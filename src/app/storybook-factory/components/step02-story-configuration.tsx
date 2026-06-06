import { ChunkyButton } from '@/components/ui/chunky-button'

export function Step02StoryConfiguration({
  onNext,
  onPrevious,
}: {
  onNext: () => void
  onPrevious: () => void
}) {
  return (
    <div className="space-y-6 mt-6">
      <div className="bg-surface-container rounded-lg p-6 space-y-2">
        <h2 className="font-headline text-2xl text-on-surface">Story Configuration</h2>
        <p className="font-body text-body-md text-on-surface-variant">
          Choose your story type and visual style.
        </p>
      </div>

      <div className="bg-surface-container rounded-lg p-6 flex flex-col items-center gap-4 text-center">
        <span
          className="material-symbols-outlined text-[48px] text-on-surface-variant"
          style={{ fontVariationSettings: "'FILL' 0" }}
        >
          construction
        </span>
        <p className="font-body text-body-md text-on-surface-variant">
          Coming soon — story type and style selection will be here.
        </p>
      </div>

      <div className="flex justify-between">
        <ChunkyButton variant="secondary" onClick={onPrevious}>
          <span className="material-symbols-outlined mr-2">arrow_back</span>
          Back
        </ChunkyButton>
        <ChunkyButton variant="primary" onClick={onNext}>
          Next
          <span className="material-symbols-outlined ml-2">arrow_forward</span>
        </ChunkyButton>
      </div>
    </div>
  )
}
