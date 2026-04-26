import { foodItems } from '../Inventory/inventoryData.js'

// Keep public neighborhood coordinates separate from the exact pickup point.
const MAP_LAB_POSTS = [
  {
    id: 301,
    food_item: {
      ...foodItems[1],
      owner_name: 'Ari Flores',
    },
    title: 'Soup night carrots',
    description:
      'Still crisp and sweet. Great for roasting, soup, or a quick slaw.',
    owner_name: 'Ari Flores',
    neighborhood_name: 'Echo Park',
    neighborhood_hint: 'Near the neighborhood fridge cluster by the park edge.',
    public_center: [34.0789, -118.2592],
    public_radius_meters: 420,
    exact_location: {
      address: '214 Maple Court, Unit 3',
      pickup_notes: 'Text on arrival and meet at the front bench cooler.',
      point: [34.0806, -118.2568],
    },
    status: 'available',
    claimed_by: '',
    requested_at: '',
    matched_at: '',
    created_at: '2026-04-25',
  },
  {
    id: 302,
    food_item: {
      ...foodItems[2],
      owner_name: 'Nora Ali',
    },
    title: 'Fresh basil bundle',
    description:
      'Perfect for pasta or pesto tonight. Best picked up before 8 PM.',
    owner_name: 'Nora Ali',
    neighborhood_name: 'Silver Lake',
    neighborhood_hint: 'Shared pickup area around Sunset Junction.',
    public_center: [34.0907, -118.2799],
    public_radius_meters: 380,
    exact_location: {
      address: '88 Juniper Terrace, Rear Gate',
      pickup_notes: 'Use the side gate and grab the labeled paper bag.',
      point: [34.0892, -118.2774],
    },
    status: 'available',
    claimed_by: '',
    requested_at: '',
    matched_at: '',
    created_at: '2026-04-24',
  },
  {
    id: 303,
    food_item: {
      ...foodItems[3],
      owner_name: 'Leo Park',
    },
    title: 'Sealed yogurt tub',
    description:
      'Unopened and cold. Good for sauces, breakfast bowls, or marinades.',
    owner_name: 'Leo Park',
    neighborhood_name: 'Koreatown',
    neighborhood_hint: 'Public view stays around the Vermont / 6th area.',
    public_center: [34.0637, -118.3008],
    public_radius_meters: 460,
    exact_location: {
      address: '401 Cedar Walk, Lobby Shelf',
      pickup_notes: 'Ask concierge for the NeighborFridge pickup bin.',
      point: [34.0618, -118.2987],
    },
    status: 'available',
    claimed_by: '',
    requested_at: '',
    matched_at: '',
    created_at: '2026-04-23',
  },
  {
    id: 304,
    food_item: {
      ...foodItems[5],
      owner_name: 'Maya Chen',
    },
    title: 'Tomatoes for tonight',
    description:
      'Ripe and ready. Would love these to get used before tomorrow lunch.',
    owner_name: 'Maya Chen',
    neighborhood_name: 'Highland Park',
    neighborhood_hint: 'Visible only as a York Boulevard neighborhood zone.',
    public_center: [34.1125, -118.1917],
    public_radius_meters: 430,
    exact_location: {
      address: '19 Pine Street, Front Desk',
      pickup_notes: 'Front desk has a paper tag with your match name.',
      point: [34.1111, -118.1941],
    },
    status: 'available',
    claimed_by: '',
    requested_at: '',
    matched_at: '',
    created_at: '2026-04-22',
  },
]

export function createMarketplaceMapPosts() {
  return MAP_LAB_POSTS.map((post) => ({
    ...post,
    food_item: { ...post.food_item },
    exact_location: { ...post.exact_location, point: [...post.exact_location.point] },
    public_center: [...post.public_center],
  }))
}
