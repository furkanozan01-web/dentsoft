function DonutChart({ ratio }: { ratio: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const filled = ratio * circ
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r={r} fill="none" stroke="#F0F4F9" strokeWidth="10" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="#2DD4BF"
        strokeWidth="10"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
      />
    </svg>
  )
}

export default DonutChart
