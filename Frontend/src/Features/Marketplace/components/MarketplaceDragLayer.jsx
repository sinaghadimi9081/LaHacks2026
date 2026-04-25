import { useDragLayer } from 'react-dnd'

function MarketplaceDragLayer() {
  const { cursorOffset, isDragging, item } = useDragLayer((monitor) => ({
    cursorOffset: monitor.getClientOffset(),
    isDragging: monitor.isDragging(),
    item: monitor.getItem(),
  }))

  if (!isDragging || !cursorOffset || !item?.post) {
    return null
  }

  return (
    <div className="market-drag-preview-wrap">
      <div
        className="market-drag-preview"
        style={{
          transform: `translate(${cursorOffset.x}px, ${cursorOffset.y}px) translate(-50%, -50%)`,
        }}
      >
        <img
          alt=""
          className="market-drag-preview__image"
          src={item.post.food_item.image}
        />
        <div className="min-w-0">
          <p>{item.post.food_item.name}</p>
          <span>{item.post.food_item.quantity}</span>
        </div>
      </div>
    </div>
  )
}

export default MarketplaceDragLayer
