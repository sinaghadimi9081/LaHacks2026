import { useEffect } from 'react'
import { useDrag } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'

import { formatDistanceMiles } from '../marketplaceLocation.js'

const postStatusStyles = {
  available: 'bg-citrus text-ink',
  pending: 'bg-mustard text-white',
  claimed: 'bg-phthalo text-white',
}

const foodStatusStyles = {
  fresh: 'bg-phthalo text-white',
  'use soon': 'bg-moonstone text-ink',
  'feed today': 'bg-mustard text-white',
  critical: 'bg-danger text-white',
}

const foodStatusCardClasses = {
  critical: 'ingredient-card--critical',
  'feed today': 'ingredient-card--feed-today',
  'use soon': 'ingredient-card--use-soon',
}

function formatPostDate(date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(String(date).includes('T') ? date : `${date}T12:00:00`))
}

function MarketplacePostCard({
  index,
  isInCart,
  isSelected,
  onAddToCart,
  onClaimPost,
  onSelectPost,
  post,
}) {
  const tilt = index % 2 === 0 ? '-1.2deg' : '1deg'
  const isUnavailable = post.status !== 'available'
  const foodStatusClass = foodStatusCardClasses[post.food_item.status] || ''
  const requestLabel =
    post.viewer_request_status === 'approved'
      ? 'matched'
      : post.viewer_request_status === 'pending'
        ? 'pending approval'
        : post.status === 'pending'
          ? 'owner reviewing'
          : post.claimed_by || 'open'
  const actionLabel = post.is_owner
    ? post.status === 'pending'
      ? 'Review requests'
      : 'Your listing'
    : post.status === 'claimed'
      ? post.viewer_request_status === 'approved'
        ? 'Matched'
        : 'Already matched'
      : post.status === 'pending'
        ? post.viewer_request_status === 'pending'
          ? 'Request pending'
          : 'Awaiting owner'
        : isInCart
          ? 'Request meetup'
          : 'Add to basket'
  const [{ isDragging }, dragRef, previewRef] = useDrag(
    () => ({
      canDrag: !isUnavailable && !post.is_owner,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      item: { post, type: 'MARKETPLACE_POST' },
      type: 'MARKETPLACE_POST',
    }),
    [isUnavailable, post],
  )

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true })
  }, [previewRef])

  return (
    <article
      className={`market-post-card ingredient-card ${foodStatusClass} ${
        isUnavailable || post.is_owner ? 'opacity-75' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'market-post-card--dragging' : ''} ${
        isSelected ? 'market-post-card--selected' : ''
      }`}
      onClick={() => onSelectPost?.(post.id)}
      ref={dragRef}
      style={{ '--tilt': tilt }}
    >
      <div className="paper-clip" aria-hidden="true" />

      <div className="photo-sheet z-10">
        <div className="fruit-sticker right-3 top-4 bg-citrus rotate-6">
          <span>{post.food_item.quantity}</span>
        </div>
        <span
          className={`absolute right-0 top-14 -rotate-6 z-20 rounded-full border border-ink/15 px-2.5 py-1.5 text-[0.65rem] font-black uppercase leading-none shadow-sticker ${foodStatusStyles[post.food_item.status] || 'bg-white text-ink'}`}
        >
          {post.food_item.status}
        </span>

        <img
          alt={`${post.food_item.name} shared food`}
          className="food-item-image"
          loading="lazy"
          src={post.food_item.image}
        />
      </div>

      <div className="recipe-card">
        <div className="flex items-start justify-between gap-3 border-b-2 border-moonstone pb-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-tomato">
              {post.food_item.name}
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase leading-none">
              {post.title}
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={`rounded-full border border-ink/15 px-2.5 py-1.5 text-[0.65rem] font-black uppercase shadow-sticker ${postStatusStyles[post.status]}`}
            >
              {post.status === 'claimed'
                ? 'matched'
                : post.status === 'pending'
                  ? 'pending'
                  : post.status}
            </span>
          </div>
        </div>

        <p className="market-post-card__description text-sm font-bold leading-7 text-ink/75">
          {post.description}
        </p>

        <dl className="receipt-lines">
          <div>
            <dt>pickup</dt>
            <dd>{post.pickup_location}</dd>
          </div>
          <div>
            <dt>posted</dt>
            <dd>{formatPostDate(post.created_at)}</dd>
          </div>
          <div>
            <dt>distance</dt>
            <dd>{formatDistanceMiles(post.distance_miles)}</dd>
          </div>
          <div>
            <dt>request</dt>
            <dd>{requestLabel}</dd>
          </div>
        </dl>

        <button
          className="pantry-button w-full"
          disabled={post.is_owner || (isUnavailable && !isInCart)}
          onClick={() => (isInCart ? onClaimPost(post.id) : onAddToCart(post.id))}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </article>
  )
}

export default MarketplacePostCard
