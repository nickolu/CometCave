import { ChunkyButton } from '@/components/ui/chunky-button'

export function Step01UploadAndDescribe({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6 mt-6">
      <div className="bg-surface-container rounded-lg p-6 space-y-2">
        <h2 className="font-headline text-2xl text-on-surface">Upload &amp; Describe</h2>
        <p className="font-body text-body-md text-on-surface-variant">
          Upload two images and describe them to get started.
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
          Coming soon — image upload and description will be here.
        </p>
      </div>

      <div className="flex justify-end">
        <ChunkyButton variant="primary" onClick={onNext}>
          Next
          <span className="material-symbols-outlined ml-2">arrow_forward</span>
        </ChunkyButton>
      </div>
    </div>
  )
}
