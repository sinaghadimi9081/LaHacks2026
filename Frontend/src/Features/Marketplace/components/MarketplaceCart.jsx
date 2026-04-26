import { useCallback, useRef } from 'react'
import { useDrop } from 'react-dnd'

function BasketFoodSlip({ index, onInsertPost, onRemovePost, post }) {
  const slipRef = useRef(null)
  const [{ insertSide, isOver }, dropRef] = useDrop(
    () => ({
      accept: 'MARKETPLACE_POST',
      canDrop: (item) => item.post?.status === 'available',
      collect: (monitor) => {
        const clientOffset = monitor.getClientOffset()
        const rect = slipRef.current?.getBoundingClientRect()

        if (!clientOffset || !rect) {
          return { insertSide: 'after', isOver: monitor.isOver() }
        }

        return {
          insertSide:
            clientOffset.y < rect.top + rect.height / 2 ? 'before' : 'after',
          isOver: monitor.isOver({ shallow: true }),
        }
      },
      drop: (item, monitor) => {
        const clientOffset = monitor.getClientOffset()
        const rect = slipRef.current?.getBoundingClientRect()
        const shouldInsertBefore =
          clientOffset && rect
            ? clientOffset.y < rect.top + rect.height / 2
            : false

        onInsertPost(item.post.id, index + (shouldInsertBefore ? 0 : 1))
        return { handled: true }
      },
    }),
    [index, onInsertPost],
  )

  const setSlipRef = useCallback(
    (node) => {
      slipRef.current = node
      dropRef(node)
    },
    [dropRef],
  )

  return (
    <div
      className={`market-basket__food-slip ${
        isOver ? `market-basket__food-slip--${insertSide}` : ''
      }`}
      ref={setSlipRef}
      style={{ '--slip-tilt': `${index % 2 === 0 ? -2 : 2}deg` }}
    >
      <img
        alt=""
        className="market-basket__food-image"
        src={post.food_item.image}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-black uppercase">
          {post.food_item.name}
        </p>
        <p className="truncate text-xs font-bold text-ink/65">
          {post.pickup_location}
        </p>
      </div>
      <button
        aria-label={`Remove ${post.food_item.name} from basket`}
        className="market-basket__remove"
        onClick={() => onRemovePost(post.id)}
        type="button"
      >
        x
      </button>
    </div>
  )
}

function MarketplaceCart({
  cartPosts,
  hasUserLocation,
  isOpen,
  onAddPost,
  onChangeRequestMode,
  onClaimCart,
  onMoveStart,
  onToggleOpen,
  onRemovePost,
  requestMode,
  sandboxMode,
}) {
  const [{ isOver, canDrop }, dropRef] = useDrop(
    () => ({
      accept: 'MARKETPLACE_POST',
      canDrop: (item) => item.post?.status === 'available',
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver({ shallow: true }),
      }),
      drop: (item, monitor) => {
        if (monitor.didDrop()) {
          return
        }

        if (item.post?.id) {
          onAddPost(item.post.id, cartPosts.length)
        }
      },
    }),
    [cartPosts.length, onAddPost],
  )
  const isCartTargeted = isOver && canDrop

  return (
    <aside
      className={`market-cart-shell ${isOpen ? 'market-cart-shell--open' : ''}`}
      onPointerDown={(event) => {
        if (event.target.closest('button, a, input, select, textarea')) {
          return
        }

        onMoveStart(event)
      }}
      ref={dropRef}
    >
      <div className="market-cart-shell__header">
        <div className="min-w-0">
          <p className="pantry-label">meetup cart</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none">
            Basket
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="grid h-12 min-w-12 place-items-center rounded-full border border-ink/15 bg-white text-lg font-black shadow-sticker">
            {cartPosts.length}
          </span>
        </div>
      </div>

      <button
        className="market-cart-toggle"
        onClick={onToggleOpen}
        type="button"
      >
        {isOpen ? 'Close basket' : 'Open basket'}
      </button>

      {isOpen && (
        <>
          {sandboxMode && (
            <div className="mb-4 rounded-[1.75rem] border border-ink/10 bg-white/70 p-4 shadow-sticker">
              <p className="pantry-label">Request option</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: 'Pickup', value: 'pickup' },
                  { label: 'Simulated delivery', value: 'delivery' },
                ].map((mode) => (
                  <button
                    className={`pantry-filter-button ${
                      requestMode === mode.value ? 'pantry-filter-button--active' : ''
                    }`}
                    key={mode.value}
                    onClick={() => onChangeRequestMode(mode.value)}
                    type="button"
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-sm font-bold leading-6 text-ink/75">
                {requestMode === 'delivery'
                  ? 'Simulated delivery uses your current browser location as the dropoff and sends only a fake quote.'
                  : 'Pickup keeps the normal meetup request flow and reveals the exact address only after approval.'}
              </p>
              <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-ink/55">
                {requestMode === 'delivery'
                  ? hasUserLocation
                    ? 'Current location ready for delivery quote'
                    : 'Turn on current location before sending a delivery request'
                  : 'No payment or courier dispatch happens in MVP'}
              </span>
            </div>
          )}

          <div
            aria-label="Drop available food items into the pickup basket"
            className={`market-basket ${isCartTargeted ? 'market-basket--targeted' : ''}`}
            role="region"
          >
            <div className="market-basket__handle" aria-hidden="true" />
            <div className="market-basket__rim" aria-hidden="true" />
            <div className="market-basket__slots" aria-hidden="true" />

            <div className="market-basket__contents">
              {cartPosts.length === 0 ? (
                <div className="market-basket__empty">
                  <p>Drag available items here</p>
                </div>
              ) : (
                cartPosts.map((post, index) => (
                  <BasketFoodSlip
                    key={post.id}
                    index={index}
                    onInsertPost={onAddPost}
                    onRemovePost={onRemovePost}
                    post={post}
                  />
                ))
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 mt-4 rounded-[1.5rem] border border-ink/10 bg-white/95 p-3 shadow-paper backdrop-blur-md">
            <button
              className="pantry-button w-full"
              disabled={cartPosts.length === 0}
              onClick={onClaimCart}
              type="button"
            >
              Request meetup
            </button>
            {sandboxMode && (
              <p className="mt-2 text-center text-xs font-black uppercase tracking-[0.12em] text-ink/65">
                Mode: {requestMode === 'delivery' ? 'Simulated delivery' : 'Pickup'}
              </p>
            )}
          </div>
        </>
      )}
      <div className="market-cart-drag-cue" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </aside>
  )
}

export default MarketplaceCart
