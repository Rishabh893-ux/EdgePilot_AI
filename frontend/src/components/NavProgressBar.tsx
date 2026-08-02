"use client"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

/**
 * Shows a thin cyan progress bar at the top of the page
 * on every route change — gives instant visual feedback so
 * navigation feels snappy even before the new page renders.
 */
export default function NavProgressBar() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [key, setKey] = useState(0)

  useEffect(() => {
    setVisible(true)
    setKey(k => k + 1)
    const t = setTimeout(() => setVisible(false), 520)
    return () => clearTimeout(t)
  }, [pathname])

  if (!visible) return null
  return <div key={key} className="nav-progress-bar" />
}
