function DonutChart({ ratio }: { ratio: number }) {
  const r = 80
  const circ = 2 * Math.PI * r
  const filled = ratio * circ
  return (
    <svg width="200" height="200" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r={r} fill="none" stroke="#F0F4F9" strokeWidth="20" />
      <circle
        cx="100"
        cy="100"
        r={r}
        fill="none"
        stroke="#2DD4BF"
        strokeWidth="20"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 100 100)"
      />
    </svg>
  )
}

export default DonutChart
