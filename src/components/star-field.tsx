'use client'

import { useEffect, useRef } from 'react'

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    // Create stars
    const stars: { x: number; y: number; radius: number; opacity: number; speed: number }[] = []
    const starCount = Math.floor((canvas.width * canvas.height) / 5000) // Adjust density

    for (let i = 0; i < starCount; i++) {
      const radius = Math.random() * 1.5
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: radius,
        opacity: Math.random() * 0.8 + 0.2,
        speed: Math.random() * 0.05 + 0.01,
      })
    }

    // Add some larger stars/sparkles
    for (let i = 0; i < 15; i++) {
      const radius = Math.random() * 2 + 1.5
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: radius,
        opacity: Math.random() * 0.5 + 0.5,
        speed: Math.random() * 0.05 + 0.02,
      })
    }

    // Animation loop
    let animationFrameId: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Draw stars
      stars.forEach(star => {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 240, ${star.opacity})`
        ctx.fill()

        // Twinkle effect for larger stars
        if (star.radius > 1.5) {
          star.opacity = 0.5 + Math.sin(Date.now() * star.speed) * 0.5
        }
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none" />
}
