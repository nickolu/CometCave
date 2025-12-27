export const DollarSigns = ({ count }: { count: number }) => {
  return Array.from({ length: count }, (_, index) => <span key={index}>$</span>)
}
