const emptyStickers = [
  { label: 'Fresh', color: 'fresh', shape: 'oval', top: '8rem', left: '5%', rotate: '-10deg' },
  { label: 'Pantry', color: 'paper', shape: 'circle', top: '18rem', left: '78%', rotate: '12deg' },
  { label: 'Share', color: 'share', shape: 'squircle', top: '34rem', left: '88%', rotate: '-8deg' },
  { label: 'Rescue', color: 'basil', shape: 'oval', top: '48rem', left: '7%', rotate: '10deg' },
  { label: 'Impact', color: 'ripe', shape: 'circle', top: '64rem', left: '70%', rotate: '-12deg' },
]

export default function Empty() {
  return (
    <main className="marketplace-page min-h-screen overflow-hidden text-ink">
      <div className="marketplace-sticker-pattern" aria-hidden="true">
        {emptyStickers.map((sticker) => (
          <div
            className={`marketplace-sticker marketplace-sticker--${sticker.color} marketplace-sticker--${sticker.shape}`}
            key={`${sticker.label}-${sticker.top}`}
            style={{
              '--sticker-left': sticker.left,
              '--sticker-rotate': sticker.rotate,
              '--sticker-top': sticker.top,
            }}
          >
            {sticker.label}
          </div>
        ))}
      </div>
    </main>
  )
}
