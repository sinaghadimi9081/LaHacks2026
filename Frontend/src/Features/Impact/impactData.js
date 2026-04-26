// Mock data for the Impact page

export const mockPersonalMetrics = {
  dollarsSaved: 142.50,
  itemsRescued: 37,
  co2Saved: 55.5, // kg — items_rescued * 1.5
  itemsShared: 14,
  itemsClaimed: 8,
}

export const mockHouseholdLeaderboard = [
  { name: 'Jasmine', dollarsSaved: 187.20, itemsRescued: 52 },
  { name: 'You', dollarsSaved: 142.50, itemsRescued: 37 },
  { name: 'Marcus', dollarsSaved: 98.30, itemsRescued: 28 },
  { name: 'Priya', dollarsSaved: 64.00, itemsRescued: 19 },
]

export const mockImprovementTips = [
  {
    emoji: '🔔',
    title: 'Share before it expires',
    description:
      'Items nearing expiration can still help a neighbor. Post them to the marketplace feed with one tap.',
  },
  {
    emoji: '🍳',
    title: "Cook what's close",
    description:
      'Check your rescue plan daily for meal ideas that use items expiring in the next 48 hours.',
  },
  {
    emoji: '🧾',
    title: 'Upload more receipts',
    description:
      'The more items you track, the better your waste insights get. Snap a receipt after every grocery run.',
  },
  {
    emoji: '🤝',
    title: 'Accept marketplace requests',
    description:
      'Claiming items that neighbors share reduces community waste and boosts your household score.',
  },
  {
    emoji: '❄️',
    title: 'Freeze surplus items',
    description:
      'Freezing extends shelf life by weeks. Move bulk purchases into the freezer early to save money.',
  },
  {
    emoji: '📊',
    title: 'Review your weekly stats',
    description:
      'Check back here every week. Tracking trends helps you spot waste patterns and improve over time.',
  },
]

export const mockWeeklyProgress = {
  current: 142.50,
  goal: 200,
  label: 'Weekly savings goal',
}
