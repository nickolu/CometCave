/**
 * The four-point sparkle that marks the parts of Micro Land a machine makes.
 *
 * Two stars rather than one: the small trailing star is what reads as "sparkle"
 * at 12px instead of as an asterisk. Drawn in `currentColor` so it takes the
 * tint of whatever button or badge it sits in, and sized in `em` so it scales
 * with the label beside it.
 */
export function SparkleIcon({ size = '1em' }: { size?: number | string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline-block', verticalAlign: '-0.12em', flex: 'none' }}
    >
      <path d="M9 2 10.4 7.6 16 9 10.4 10.4 9 16 7.6 10.4 2 9 7.6 7.6Z" />
      <path d="M17.5 13.5 18.4 17.1 22 18l-3.6.9-.9 3.6-.9-3.6L13 18l3.6-.9Z" />
    </svg>
  )
}
