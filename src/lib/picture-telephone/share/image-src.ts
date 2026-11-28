/* Picture Telephone: make an image source safe to draw on a canvas. */

/**
 * Mock-mode pictures are SVG data URLs with a viewBox but no width or height.
 * Some browsers (Firefox, older Safari) refuse to drawImage an SVG with no
 * intrinsic size, so give the root element one. Anything else passes through.
 */
export function withSvgSize(src: string, size = 1024): string {
  const m = /^data:image\/svg\+xml(;[^,]*)?,/i.exec(src)
  if (!m) return src
  const head = m[0]
  const isBase64 = /;base64/i.test(m[1] ?? '')
  let svg: string
  try {
    svg = isBase64 ? atob(src.slice(head.length)) : decodeURIComponent(src.slice(head.length))
  } catch {
    return src
  }
  const root = /<svg\b[^>]*>/i.exec(svg)
  if (!root || /\swidth\s*=/.test(root[0])) return src
  const sized = svg.replace(root[0], root[0].replace(/<svg\b/i, `<svg width="${size}" height="${size}"`))
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sized)}`
}
