export const mockMetrics = {
  totalLost: 142,
  totalFound: 89,
  activeMatches: 24,
  resolvedCases: 53,
};

export const mockItems = [
  {
    id: '1',
    type: 'lost',
    title: 'MacBook Pro 14"',
    description: 'Silver MacBook Pro with a "Campus Hackathon" sticker. Left in the Library 2nd floor.',
    category: 'Electronics',
    date: '2026-06-03',
    location: 'Main Library',
    status: 'active',
    user: 'Alex Johnson',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: '2',
    type: 'found',
    title: 'Blue Hydroflask',
    description: 'Dark blue water bottle with dents on the bottom.',
    category: 'Accessories',
    date: '2026-06-04',
    location: 'Science Building - Room 104',
    status: 'active',
    user: 'Sam Smith',
    image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80'
  },
  {
    id: '3',
    type: 'lost',
    title: 'Leather Wallet',
    description: 'Brown leather wallet containing student ID and some cash.',
    category: 'Personal',
    date: '2026-06-01',
    location: 'Cafeteria',
    status: 'active',
    user: 'Jordan Lee',
  },
  {
    id: '4',
    type: 'found',
    title: 'AirPods Pro',
    description: 'White AirPods Pro case with a black silicone cover.',
    category: 'Electronics',
    date: '2026-06-03',
    location: 'Gymnasium',
    status: 'active',
    user: 'Campus Security',
    image: 'https://images.unsplash.com/photo-1606220838315-056192d5e927?auto=format&fit=crop&w=400&q=80'
  }
];

export const mockMatches = [
  {
    id: 'm1',
    lostItem: mockItems[0],
    foundItem: {
      ...mockItems[0],
      title: 'Apple Laptop',
      location: 'Library Front Desk',
      date: '2026-06-04'
    },
    confidenceScore: 95,
    status: 'pending'
  },
  {
    id: 'm2',
    lostItem: mockItems[2],
    foundItem: {
      id: 'f99',
      type: 'found',
      title: 'Brown Wallet',
      description: 'Found a wallet on a table near the entrance.',
      category: 'Personal',
      date: '2026-06-02',
      location: 'Cafeteria',
    },
    confidenceScore: 82,
    status: 'pending'
  }
];

export const mockNotifications = [
  {
    id: 'n1',
    title: 'High Confidence Match!',
    message: 'We found a 95% match for your lost MacBook Pro 14".',
    time: '2 hours ago',
    read: false,
    type: 'match'
  },
  {
    id: 'n2',
    title: 'Item Reported',
    message: 'Your report for "Leather Wallet" has been successfully published.',
    time: '1 day ago',
    read: true,
    type: 'system'
  }
];
