/** A picture taped to the page. Pictures are data URLs held in memory, so a plain img is right. */
export function ImageCard({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="pt-frame">
      <img src={src} alt={alt} decoding="async" />
    </figure>
  )
}
