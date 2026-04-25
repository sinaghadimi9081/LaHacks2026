const statusStyles = {
  fresh: 'bg-phthalo text-white',
  'use soon': 'bg-moonstone text-ink',
  'feed today': 'bg-mustard text-white',
  critical: 'bg-tomato text-white',
}

const stickerStyles = [
  'bg-citrus rotate-[-8deg]',
  'bg-petal rotate-[7deg]',
  'bg-moonstone rotate-[-5deg]',
]

function formatDate(date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function FoodItem({ item, index }) {
  const tilt = index % 2 === 0 ? '-1.4deg' : '1.2deg'

  return (
    <article className="ingredient-card" style={{ '--tilt': tilt }}>
      <div className="paper-clip" aria-hidden="true" />

      <div className="photo-sheet z-10 drop-shadow-lg">
        <div className="fruit-sticker right-3 top-4 bg-citrus">
          <span>{item.quantity}</span>
        </div>
        <img
          alt={`${item.name} ingredient`}
          className="h-40 w-full rounded-md border-[3px] border-ink object-cover shadow-pop sm:h-44"
          loading="lazy"
          src={item.image}
        />
      </div>

      <div className="recipe-card">
        <div className="flex items-start justify-between gap-3 border-b-2 border-moonstone pb-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-tomato">
              Recipe ingredient
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase leading-none">
              {item.name}
            </h2>
          </div>
          <span
            className={`shrink-0 rounded-full border-2 border-ink px-2.5 py-1.5 text-[0.65rem] font-black uppercase shadow-sticker ${statusStyles[item.status]}`}
          >
            {item.status}
          </span>
        </div>

        <dl className="receipt-lines">
          <div>
            <dt>expires</dt>
            <dd>{formatDate(item.expiration_date)}</dd>
          </div>
          <div>
            <dt>added</dt>
            <dd>{formatDate(item.created_at)}</dd>
          </div>
          <div>
            <dt>est. price</dt>
            <dd>${Number(item.estimated_price).toFixed(2)}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-ink/55">
            recipe ideas
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.recipe_uses.map((use, useIndex) => (
              <span
                className={`rounded-full border-2 border-ink px-2.5 py-1 text-[0.65rem] font-black uppercase shadow-sticker ${stickerStyles[useIndex % stickerStyles.length]}`}
                key={use}
              >
                {use}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  )
}

export default FoodItem
