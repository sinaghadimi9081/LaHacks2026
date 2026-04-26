import { formatDistanceMiles } from '../marketplaceLocation.js'

function getSelectedPostStatusClass(status) {
  if (status === 'claimed') {
    return 'bg-phthalo text-white'
  }
  if (status === 'pending') {
    return 'bg-mustard text-white'
  }
  return 'bg-citrus text-ink'
}

function getRequestValue(post) {
  if (post.viewer_request_status === 'approved') {
    return 'matched'
  }
  if (post.viewer_request_status === 'pending') {
    return 'pending approval'
  }
  if (post.status === 'pending') {
    return 'owner reviewing'
  }
  if (post.status === 'claimed') {
    return post.claimed_by || 'matched'
  }
  return post.claimed_by || 'open'
}

export default function MarketplaceListingPreview({ className = '', onClearSelection, post }) {
  return (
    <article className={`market-listing-preview ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-dashed border-ink/20 pb-3">
        <div>
          <p className="pantry-label">Selected listing</p>
          <h2 className="mt-2 text-2xl font-black uppercase leading-none">
            {post.title}
          </h2>
        </div>
        <span
          className={`rounded-full border border-ink/15 px-3 py-1.5 text-xs font-black uppercase shadow-sticker ${getSelectedPostStatusClass(post.status)}`}
        >
          {post.status === 'claimed' ? 'matched' : post.status === 'pending' ? 'pending' : post.status}
        </span>
      </div>

      {onClearSelection ? (
        <button
          className="pantry-filter-button w-fit"
          onClick={onClearSelection}
          type="button"
        >
          Back to map
        </button>
      ) : null}

      <div className="market-map-selected">
        <img
          alt={`${post.food_item.name} listing`}
          className="market-map-selected__image"
          src={post.food_item.image}
        />

        <dl className="receipt-lines">
          <div>
            <dt>food</dt>
            <dd>{post.food_item.name}</dd>
          </div>
          <div>
            <dt>owner</dt>
            <dd>{post.owner?.full_name || post.food_item.owner_name || 'Neighbor'}</dd>
          </div>
          <div>
            <dt>distance</dt>
            <dd>{formatDistanceMiles(post.distance_miles)}</dd>
          </div>
          <div>
            <dt>pickup area</dt>
            <dd>{post.public_pickup_location || post.pickup_location}</dd>
          </div>
          <div>
            <dt>request</dt>
            <dd>{getRequestValue(post)}</dd>
          </div>
        </dl>
      </div>

      <p className="mt-3 text-sm font-bold leading-6 text-ink/75">
        {post.description}
      </p>

      <div
        className={`market-map-address-card ${
          post.exact_location_visible
            ? 'market-map-address-card--revealed'
            : 'market-map-address-card--locked'
        }`}
      >
        <p className="pantry-label">Pickup details</p>
        <strong>
          {post.exact_location_visible
            ? post.pickup_location
            : post.public_pickup_location || post.pickup_location}
        </strong>
        <p>
          {post.exact_location_visible
            ? post.is_owner
              ? 'Exact pickup details are visible because this is your listing.'
              : 'The owner approved your request, so the exact pickup location is now unlocked.'
            : post.viewer_request_status === 'pending'
              ? 'Your request is pending. The exact street address stays hidden until the owner approves it.'
              : 'Only the neighborhood-level pickup area is public. The exact location unlocks after owner approval.'}
        </p>
        <span className="market-map-address-card__meta">
          Request status: {post.viewer_request_status || post.status}
        </span>
      </div>
    </article>
  )
}
