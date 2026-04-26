import MarketplacePostForm from './MarketplacePostForm.jsx'

function SharePostModal({
  form,
  isSaving,
  onClose,
  onImageUpload,
  onSubmit,
  onUpdateForm,
  postSuggestions,
  reverifiedFoodItem,
}) {
  return (
    <div className="market-modal" role="dialog" aria-modal="true">
      <button
        aria-label="Close share form"
        className="market-modal__scrim"
        onClick={onClose}
        type="button"
      />

      <div className="market-modal__panel pantry-card grid gap-4">
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

        <MarketplacePostForm
          form={form}
          isSaving={isSaving}
          onImageUpload={onImageUpload}
          onSubmit={onSubmit}
          onUpdateForm={onUpdateForm}
          postSuggestions={postSuggestions}
          reverifiedFoodItem={reverifiedFoodItem}
        />
      </div>
    </div>
  )
}

export default SharePostModal
