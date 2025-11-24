import type { ProductData } from '../shared/product.js';

export const catalogSeed: ProductData[] = [
  {
    slug: 'aurora-lamp',
    name: 'Aurora Smart Lamp',
    price: 129,
    description: 'Dimmable glass lamp with adaptive hue and Wi-Fi control.',
    image:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
    tags: ['lighting', 'smart-home', 'new'],
    badge: 'New Arrival',
    rating: 4.8,
    stock: 24,
  },
  {
    slug: 'kinetic-chair',
    name: 'Kinetic Ergonomic Chair',
    price: 489,
    description: 'Adaptive lumbar support, breathable mesh, and minimalist silhouette.',
    image:
      'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=800&q=80',
    tags: ['furniture', 'work', 'ergonomic'],
    badge: 'Bestseller',
    rating: 4.9,
    stock: 12,
  },
  {
    slug: 'linen-duvet',
    name: 'Linen Duvet Set',
    price: 219,
    description: 'Stonewashed European flax with percale lining and hidden ties.',
    image:
      'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=800&q=80',
    tags: ['bedding', 'textiles'],
    rating: 4.6,
    stock: 40,
  },
  {
    slug: 'cloud-headphones',
    name: 'Cloud Wireless Headphones',
    price: 279,
    description: 'Adaptive noise canceling, 40h battery, spatial audio ready.',
    image:
      'https://images.unsplash.com/photo-1512314889357-e157c22f938d?auto=format&fit=crop&w=800&q=80',
    tags: ['audio', 'work', 'travel'],
    badge: 'Staff Pick',
    rating: 4.7,
    stock: 33,
  },
  {
    slug: 'brew-kit',
    name: 'Analog Brew Kit',
    price: 189,
    description: 'Precision kettle, glass dripper, and hand-milled grinder.',
    image:
      'https://images.unsplash.com/photo-1422207134147-65fb81f59e38?auto=format&fit=crop&w=800&q=80',
    tags: ['kitchen', 'coffee'],
    rating: 4.5,
    stock: 15,
  },
];
