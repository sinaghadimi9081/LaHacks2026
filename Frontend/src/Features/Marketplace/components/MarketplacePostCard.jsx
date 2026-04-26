import { useEffect } from 'react'
import { useDrag } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'

const postStatusStyles = {
  available: 'bg-citrus text-ink',
  claimed: 'bg-phthalo text-white',
}

const expirationTagStyles = {
  critical: 'bg-danger text-white',
  expired: 'bg-danger text-white',
  low_priority: 'bg-phthalo text-white',
  'use soon': 'bg-mustard text-white',
}

function formatPostDate(date) {
  const parsedDate =
    typeof date === 'string' && date.includes('T')
      ? new Date(date)
      : new Date(`${date}T12:00:00`)

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
  }).format(parsedDate)
}

function getExpirationDate(post) {
  return post.expiration_date || post.food_item?.expiration_date || ''
}

function parseDateKey(dateValue) {
  if (!dateValue) {
    return null
  }

  const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number)

  if (!year || !month || !day) {
    return null
  }

  return Date.UTC(year, month - 1, day)
}

function getTodayKey() {
  const today = new Date()
  return Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
}

function getDaysLeft(post) {
  const expirationKey = parseDateKey(getExpirationDate(post))

  if (expirationKey === null) {
    return null
  }

  return Math.round((expirationKey - getTodayKey()) / 86400000)
}

function formatExpirationDate(post) {
  const expirationDate = getExpirationDate(post)

  if (!expirationDate) {
    return 'not set'
  }

  return formatPostDate(expirationDate)
}

function getExpirationState(post) {
  const daysLeft = getDaysLeft(post)

  if (daysLeft !== null && daysLeft <= 0) {
    return {
      cardClass: 'ingredient-card--critical',
      label: 'expired',
      tag: 'expired',
    }
  }

  if (daysLeft !== null && daysLeft <= 1) {
    return {
      cardClass: 'ingredient-card--critical',
      label: 'critical',
      tag: 'critical',
    }
  }

  if (daysLeft !== null && daysLeft <= 3) {
    return {
      cardClass: 'ingredient-card--feed-today',
      label: 'use soon',
      tag: 'use soon',
    }
  }

  return {
    cardClass: '',
    label: 'low_priority',
    tag: 'low_priority',
  }
}

function MarketplacePostCard({
  index,
  isInCart,
  onAddToCart,
  onClaimPost,
  post,
}) {
  const tilt = index % 2 === 0 ? '-1.2deg' : '1deg'
  const isClaimed = post.status === 'claimed'
  const expirationState = getExpirationState(post)
  const ownerUsername = post.owner?.username || 'neighbor'
  const [{ isDragging }, dragRef, previewRef] = useDrag(
    () => ({
      canDrag: !isClaimed,
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
      item: { post, type: 'MARKETPLACE_POST' },
      type: 'MARKETPLACE_POST',
    }),
    [isClaimed, post],
  )

  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true })
  }, [previewRef])

  return (
    <article
      className={`market-post-card ingredient-card ${expirationState.cardClass} ${
        isClaimed ? 'opacity-75' : 'cursor-grab active:cursor-grabbing'
      } ${isDragging ? 'market-post-card--dragging' : ''}`}
      ref={dragRef}
      style={{ '--tilt': tilt }}
    >
      <div className="paper-clip" aria-hidden="true" />

      <div className="photo-sheet z-10">
        <div className="fruit-sticker right-3 top-4 bg-citrus rotate-6">
          <span>{post.food_item.quantity}</span>
        </div>
        <span
          className={`absolute right-0 top-14 -rotate-6 z-20 rounded-full border border-ink/15 px-2.5 py-1.5 text-[0.65rem] font-black uppercase leading-none shadow-sticker ${expirationTagStyles[expirationState.tag] || 'bg-white text-ink'}`}
        >
          {expirationState.label}
        </span>

        <img
          alt={`${post.food_item.name} shared food`}
          className="food-item-image"
          loading="lazy"
          src={post.food_item.image || '/favicon.svg'}
        />
      </div>

      <div className="recipe-card">
        <div className="flex items-start justify-between gap-3 border-b-2 border-moonstone pb-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-tomato">
              @{ownerUsername}
            </p>
            <h2 className="mt-1 text-2xl font-black uppercase leading-none">
              {post.title || post.item_name || post.food_item.name}
            </h2>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              className={`rounded-full border border-ink/15 px-2.5 py-1.5 text-[0.65rem] font-black uppercase shadow-sticker ${postStatusStyles[post.status]}`}
            >
              {post.status === 'claimed' ? 'requested' : post.status}
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
            <dt>expires</dt>
            <dd>{formatExpirationDate(post)}</dd>
          </div>
          <div>
            <dt>request</dt>
            <dd>{post.claimed_by || 'open'}</dd>
          </div>
        </dl>

        <button
          className="pantry-button w-full"
          disabled={isClaimed}
          onClick={() => (isInCart ? onClaimPost(post.id) : onAddToCart(post.id))}
          type="button"
        >
          {isClaimed
            ? 'Meetup requested'
            : isInCart
              ? 'Request meetup'
              : 'Add to basket'}
        </button>
      </div>
    </article>
  )
}

export default MarketplacePostCard
