const marketplaceBackgroundStickers = [
  { label: 'Fresh', color: 'fresh', shape: 'oval', top: '15rem', left: '6%', rotate: '-10deg' },
  { label: 'Local', color: 'local', shape: 'circle', top: '22rem', left: '74%', rotate: '12deg' },
  { label: 'Ripe', color: 'ripe', shape: 'squircle', top: '33rem', left: '86%', rotate: '8deg' },
  { label: 'Share', color: 'share', shape: 'oval', top: '42rem', left: '4%', rotate: '-7deg' },
  { label: 'Apple', color: 'apple', shape: 'circle', top: '54rem', left: '64%', rotate: '15deg' },
  { label: 'Citrus', color: 'fresh', shape: 'squircle', top: '66rem', left: '88%', rotate: '-13deg' },
  { label: 'Basil', color: 'basil', shape: 'oval', top: '78rem', left: '10%', rotate: '9deg' },
  { label: 'Tomato', color: 'share', shape: 'circle', top: '91rem', left: '72%', rotate: '-11deg' },
  { label: 'Carrot', color: 'local', shape: 'squircle', top: '103rem', left: '3%', rotate: '11deg' },
  { label: 'Pantry', color: 'paper', shape: 'oval', top: '116rem', left: '84%', rotate: '-6deg' },
  { label: 'Picked', color: 'ripe', shape: 'circle', top: '129rem', left: '18%', rotate: '14deg' },
  { label: 'Dinner', color: 'fresh', shape: 'oval', top: '142rem', left: '68%', rotate: '-12deg' },
  { label: 'Soup', color: 'local', shape: 'circle', top: '155rem', left: '42%', rotate: '10deg' },
  { label: 'Snack', color: 'apple', shape: 'squircle', top: '168rem', left: '80%', rotate: '-9deg' },
  { label: 'Pesto', color: 'basil', shape: 'oval', top: '181rem', left: '7%', rotate: '13deg' },
  { label: 'Pickup', color: 'paper', shape: 'squircle', top: '194rem', left: '58%', rotate: '-8deg' },
]

export default function MarketplaceBackground() {
  return (
    <div className="marketplace-sticker-pattern" aria-hidden="true">
      {marketplaceBackgroundStickers.map((sticker) => (
        <span
          className={`marketplace-sticker marketplace-sticker--${sticker.color} marketplace-sticker--${sticker.shape}`}
          key={`${sticker.label}-${sticker.top}`}
          style={{
            '--sticker-left': sticker.left,
            '--sticker-rotate': sticker.rotate,
            '--sticker-top': sticker.top,
          }}
        >
          {sticker.label}
        </span>
      ))}
    </div>
  )
}
