import { useLayoutEffect, useRef, useState } from 'react'

const A4_WIDTH = 794 // px at 96 dpi; documents inside are rendered at this width

// Shows an A4-width document scaled down to fit its container (never scaled up).
// crop = the container's height comes from CSS (thumbnails); otherwise it matches the scaled page.
export default function ScaledPaper({ children, crop = false, className = '' }) {
  const boxRef = useRef(null)
  const pageRef = useRef(null)
  const [fit, setFit] = useState({ scale: 0, left: 0, height: 0 })

  useLayoutEffect(() => {
    const box = boxRef.current
    const page = pageRef.current
    const measure = () => {
      const scale = Math.min(1, box.clientWidth / A4_WIDTH)
      setFit({ scale, left: (box.clientWidth - A4_WIDTH * scale) / 2, height: page.offsetHeight * scale })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    ro.observe(page)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={boxRef} className={`scaled ${className}`} style={crop ? undefined : { height: fit.height }}>
      <div
        ref={pageRef}
        className="scaled-page"
        style={{ width: A4_WIDTH, transform: `translateX(${fit.left}px) scale(${fit.scale})`, visibility: fit.scale ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
    </div>
  )
}
