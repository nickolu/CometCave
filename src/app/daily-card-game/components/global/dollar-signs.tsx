export const DollarSigns = ({ count }: { count: number }) => {
  return Array.from({ length: count }, (_, index) => (
    <span className="text-space-gold" key={index}>
      $
    </span>
  ))
}
