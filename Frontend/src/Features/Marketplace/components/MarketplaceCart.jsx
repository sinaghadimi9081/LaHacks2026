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
  isOpen,
  onAddPost,
  onClaimCart,
  onToggleOpen,
  onRemovePost,
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
      ref={dropRef}
    >
      <div className="market-cart-shell__header">
        <div className="min-w-0">
          <p className="pantry-label">meetup cart</p>
          <h2 className="mt-2 text-4xl font-black uppercase leading-none">
            Basket
          </h2>
        </div>
        <span className="grid h-12 min-w-12 place-items-center rounded-full border border-ink/15 bg-white text-lg font-black shadow-sticker">
          {cartPosts.length}
        </span>
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

          <button
            className="pantry-button w-full"
            disabled={cartPosts.length === 0}
            onClick={onClaimCart}
            type="button"
          >
            Request meetup
          </button>
        </>
      )}
    </aside>
  )
}

export default MarketplaceCart
