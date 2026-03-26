import { Product, ProductCategory } from '../../types';

export const INITIAL_PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: 'cat1', name: 'Shampoing', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'cat2', name: 'Soin', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { id: 'cat3', name: 'Accessoire', color: 'bg-amber-100 text-amber-800 border-amber-200' },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Shampoing Réparateur Kératine',
    description: 'Un shampoing doux enrichi en kératine pour réparer les cheveux abîmés.',
    categoryId: 'cat1',
    price: 24.90,
    cost: 12.50,
    sku: 'SHP-KER-250',
    stock: 45,
    supplier: 'L\'Oréal Pro',
    active: true
  },
  {
    id: 'p2',
    name: 'Masque Hydratant Intense',
    description: 'Masque profond pour une hydratation longue durée.',
    categoryId: 'cat2',
    price: 32.00,
    cost: 15.00,
    sku: 'MSK-HYD-500',
    stock: 8,
    supplier: 'Kérastase',
    active: true
  },
  {
    id: 'p3',
    name: 'Brosse Demelante',
    description: 'Brosse ergonomique qui ne casse pas le cheveu.',
    categoryId: 'cat3',
    price: 18.50,
    cost: 6.00,
    sku: 'ACC-BRS-01',
    stock: 0,
    supplier: 'GHD',
    active: true
  }
];