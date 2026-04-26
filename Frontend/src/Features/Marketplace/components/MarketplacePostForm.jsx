import { useMemo, useState } from 'react'

function MarketplacePostForm({
  form,
  isSaving = false,
  onImageUpload,
  onSubmit,
  onUpdateForm,
  postSuggestions = [],
  reverifiedFoodItem,
  submitLabel = 'Share item',
}) {
  const [postSearch, setPostSearch] = useState('')
  const normalizedPostSearch = postSearch.trim().toLowerCase()
  const matchingPostSuggestions = useMemo(() => {
    if (!normalizedPostSearch) {
      return []
    }

    return postSuggestions
      .filter((post) =>
        [
          post.item_name,
          post.quantity_label,
          post.title,
          post.description,
          post.pickup_location,
          post.status,
          post.food_item?.name,
          post.food_item?.quantity,
          ...(post.tags || post.food_item?.recipe_uses || []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedPostSearch),
      )
      .slice(0, 4)
  }, [normalizedPostSearch, postSuggestions])

  function selectPostSuggestion(post) {
    onUpdateForm('item_name', post.item_name || post.food_item?.name || '')
    onUpdateForm('quantity_label', post.quantity_label || post.food_item?.quantity || '')
    onUpdateForm('description', post.description || '')
    onUpdateForm('expiration_date', post.expiration_date || post.food_item?.expiration_date || '')
    setPostSearch(post.item_name || post.food_item?.name || post.title || '')
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="block">
        <span className="pantry-field-label">Search posts</span>
        <input
          className="pantry-input"
          onChange={(event) => {
            setPostSearch(event.target.value)
            onUpdateForm('item_name', event.target.value)
          }}
          placeholder="Apples, basil, yogurt..."
          type="search"
          value={postSearch || form.item_name}
        />
      </label>

      {matchingPostSuggestions.length ? (
        <div className="grid gap-2">
          {matchingPostSuggestions.map((post) => (
            <button
              className="rounded-xl border border-ink/15 bg-white/85 p-3 text-left shadow-sticker transition hover:-translate-y-0.5"
              key={post.id}
              onClick={() => selectPostSuggestion(post)}
              type="button"
            >
              <span className="block text-sm font-black uppercase text-ink">
                {post.item_name || post.food_item?.name || post.title}
              </span>
              <span className="mt-1 block text-xs font-black uppercase tracking-[0.12em] text-ink/55">
                {post.status} - {post.quantity_label || post.food_item?.quantity || 'quantity open'}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="pantry-field-label">Post title</span>
          <input
            className="pantry-input"
            onChange={(event) => onUpdateForm('item_name', event.target.value)}
            placeholder="Honeycrisp apples for baking"
            required
            type="text"
            value={form.item_name}
          />
        </label>

        <label className="block">
          <span className="pantry-field-label">Quantity</span>
          <input
            className="pantry-input"
            onChange={(event) => onUpdateForm('quantity_label', event.target.value)}
            placeholder="8 apples"
            required
            type="text"
            value={form.quantity_label}
          />
        </label>
      </div>

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
        <span className="pantry-field-label">Expiration date</span>
        <input
          className="pantry-input"
          onChange={(event) => onUpdateForm('expiration_date', event.target.value)}
          required
          type="date"
          value={form.expiration_date}
        />
      </label>

      <label className="block">
        <span className="pantry-field-label">Pickup location</span>
        <input
          className="pantry-input"
          onChange={(event) => onUpdateForm('pickup_location', event.target.value)}
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
          alt={`${form.item_name || 'Marketplace item'} verification preview`}
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

      <button className="pantry-button" disabled={isSaving} type="submit">
        {isSaving ? 'Sharing...' : submitLabel}
      </button>
    </form>
  )
}

export default MarketplacePostForm
