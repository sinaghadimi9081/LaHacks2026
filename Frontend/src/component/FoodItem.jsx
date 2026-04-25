const statusStyles = {
  fresh: 'bg-phthalo text-white',
  'use soon': 'bg-moonstone text-ink',
  'feed today': 'bg-mustard text-white',
  critical: 'bg-tomato text-white',
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function FoodItem({ item, index }) {
  return (
    <article
      className="ingredient-card"
      style={{ '--tilt': `${index % 2 === 0 ? -1 : 1}deg` }}
    >
      <div className="relative z-10 border-none-important">
        <div className="absolute left-2 top-4 z-10 rotate-[-8deg] rounded-full border-2 border-ink bg-citrus px-3 py-1 text-xs font-black uppercase shadow-sticker">
          {item.quantity}
        </div>
        <img
          alt={item.name}
          className="h-56 w-full rounded-t-md border-b-4 border-ink object-cover shadow-card"
          src={item.image}
        />
      </div>

      <div className="receipt-panel">
        <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-ink pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-tomato">
              Market receipt
            </p>
            <h2 className="mt-1 text-3xl font-black uppercase leading-none">
              {item.name}
            </h2>
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-black uppercase ${statusStyles[item.status]}`}
          >
            {item.status}
          </span>
        </div>

        <dl className="receipt-lines">
          <div>
            <dt>qty</dt>
            <dd>{item.quantity}</dd>
          </div>
          <div>
            <dt>expires</dt>
            <dd>{formatDate(item.expiration_date)}</dd>
          </div>
          <div>
            <dt>added</dt>
            <dd>{formatDate(item.created_at)}</dd>
          </div>
        </dl>

      </div>
    </article>
  )
}

export default FoodItem
