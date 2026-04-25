function SharePostModal({
  form,
  foodItems,
  onClose,
  onImageUpload,
  onSubmit,
  onUpdateForm,
  reverifiedFoodItem,
  selectedInventoryItem,
}) {
  return (
    <div className="market-modal" role="dialog" aria-modal="true">
      <button
        aria-label="Close share form"
        className="market-modal__scrim"
        onClick={onClose}
        type="button"
      />

      <form className="market-modal__panel pantry-card grid gap-4" onSubmit={onSubmit}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="pantry-label">share from inventory</p>
            <h2 className="mt-2 text-4xl font-black uppercase leading-none">
              New post
            </h2>
          </div>
          <button
            className="pantry-filter-button shrink-0"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <label className="block">
          <span className="pantry-field-label">Food item</span>
          <select
            className="pantry-input"
            onChange={(event) => onUpdateForm('foodItemName', event.target.value)}
            value={form.foodItemName}
          >
            {foodItems.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name} - {item.quantity}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="pantry-field-label">Title</span>
          <input
            className="pantry-input"
            onChange={(event) => onUpdateForm('title', event.target.value)}
            placeholder="Extra apples for baking"
            required
            type="text"
            value={form.title}
          />
        </label>

        <label className="block">
          <span className="pantry-field-label">Description</span>
          <textarea
            className="pantry-input min-h-28 resize-y"
            onChange={(event) => onUpdateForm('description', event.target.value)}
            placeholder="Condition, timing, and anything a neighbor should know"
            required
            value={form.description}
          />
        </label>

        <label className="block">
          <span className="pantry-field-label">Pickup location</span>
          <input
            className="pantry-input"
            onChange={(event) =>
              onUpdateForm('pickup_location', event.target.value)
            }
            placeholder="Community fridge, lobby shelf, porch cooler..."
            required
            type="text"
            value={form.pickup_location}
          />
        </label>

        <label className="block">
          <span className="pantry-field-label">Reverify with image</span>
          <input
            accept="image/*"
            className="pantry-input file:mr-4 file:rounded-full file:border-0 file:bg-citrus file:px-4 file:py-2 file:text-xs file:font-black file:uppercase file:text-ink"
            onChange={onImageUpload}
            required
            type="file"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr] sm:items-center">
          <img
            alt={`${selectedInventoryItem.name} verification preview`}
            className="aspect-[4/3] w-full rounded-xl border border-ink/15 bg-cream object-cover shadow-pop"
            src={reverifiedFoodItem.image}
          />
          <dl className="receipt-lines">
            <div>
              <dt>status</dt>
              <dd>available</dd>
            </div>
            <div>
              <dt>request</dt>
              <dd>open</dd>
            </div>
            <div>
              <dt>created</dt>
              <dd>today</dd>
            </div>
          </dl>
        </div>

        <button className="pantry-button" type="submit">
          Share item
        </button>
      </form>
    </div>
  )
}

export default SharePostModal
