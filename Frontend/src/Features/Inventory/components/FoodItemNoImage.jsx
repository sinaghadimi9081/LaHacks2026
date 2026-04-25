const statusStyles = {
  fresh: 'bg-phthalo text-white',
  'use soon': 'bg-moonstone text-ink',
  'feed today': 'bg-mustard text-white',
  critical: 'bg-tomato text-white',
}

const noteStyles = ['bg-citrus', 'bg-petal', 'bg-moonstone']

function formatDate(date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`))
}

function FoodItemNoImage({ item, index }) {
  const tilt = index % 2 === 0 ? '1deg' : '-1.2deg'

  return (
    <article
      className="ingredient-card ingredient-card--text-only"
      style={{ '--tilt': tilt }}
    >
      <div className="recipe-card recipe-card--full">
        <div className="flex items-start justify-between gap-3 border-b-2 border-moonstone pb-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-tomato">
              Pantry note
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
            <dt>qty</dt>
            <dd>{item.quantity}</dd>
          </div>
          <div>
            <dt>expires</dt>
            <dd>{formatDate(item.expiration_date)}</dd>
          </div>
          <div>
            <dt>owner</dt>
            <dd>{item.owner_name}</dd>
          </div>
        </dl>

        <div className="mt-3 grid gap-2">
          {item.notes.map((note, noteIndex) => (
            <p
              className={`rounded-md border-2 border-ink px-3 py-2 text-sm font-extrabold leading-5 shadow-sticker ${noteStyles[noteIndex % noteStyles.length]}`}
              key={note}
            >
              {note}
            </p>
          ))}
        </div>
      </div>
    </article>
  )
}

export default FoodItemNoImage
