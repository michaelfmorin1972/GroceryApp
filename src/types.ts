export type Item = {
  id: string;
  name: string;
  section: string | null;
  qty: number;
  checked: boolean;
  createdAt: number;
};

/** Remembered info about items added to a list before (suggestions + section memory). */
export type KnownItem = {
  name: string;
  section: string | null;
  lastUsed: number;
};

export type ListMeta = {
  id: string;
  name: string;
  icon: string;
  /** What sections are called on this list, e.g. "Aisle", "Department". */
  sectionLabel: string;
  sections: string[];
  order: number;
  createdAt: number;
};

export type ViewMode = 'list' | 'sections';

export type ListTemplate = Pick<ListMeta, 'name' | 'icon' | 'sectionLabel' | 'sections'>;

export const TEMPLATES: ListTemplate[] = [
  {
    name: 'Groceries',
    icon: '🛒',
    sectionLabel: 'Aisle',
    sections: [
      'Produce', 'Bakery', 'Deli', 'Meat & Seafood', 'Dairy & Eggs', 'Frozen',
      'Canned Goods', 'Pasta & Grains', 'Snacks', 'Beverages', 'Household', 'Personal Care',
    ],
  },
  {
    name: 'Hardware',
    icon: '🔨',
    sectionLabel: 'Department',
    sections: [
      'Tools', 'Fasteners', 'Plumbing', 'Electrical', 'Paint', 'Lumber',
      'Lighting', 'Garden & Outdoor', 'Cleaning', 'Storage',
    ],
  },
  {
    name: 'Clothing',
    icon: '👕',
    sectionLabel: 'Category',
    sections: ['Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Underwear & Socks', 'Sleepwear', 'Accessories', 'Kids'],
  },
  {
    name: 'Bulk',
    icon: '📦',
    sectionLabel: 'Aisle',
    sections: [
      'Produce', 'Meat', 'Dairy', 'Frozen', 'Pantry', 'Snacks', 'Beverages',
      'Paper Goods', 'Cleaning', 'Personal Care', 'Pets',
    ],
  },
];

export const BLANK_TEMPLATE: ListTemplate = { name: '', icon: '📝', sectionLabel: 'Section', sections: [] };

export const ICON_CHOICES = ['🛒', '🔨', '👕', '📦', '💊', '🐶', '🎁', '🏕️', '🧸', '🍷', '🌱', '🏠', '🎒', '📝'];

/** Normalizes a name for duplicate detection: case, spacing, and simple plurals. */
export function itemKey(name: string): string {
  let k = name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (k.length > 3 && k.endsWith('es') && /(ch|sh|x|ss|o)es$/.test(k)) k = k.slice(0, -2);
  else if (k.length > 3 && k.endsWith('s') && !k.endsWith('ss')) k = k.slice(0, -1);
  return k;
}

/** Firestore doc ids can't contain "/" or be "." / "..". */
export function docId(name: string): string {
  const k = itemKey(name).replace(/\//g, '_');
  return k === '' || k === '.' || k === '..' ? `_${k}` : k;
}

export const cleanText = (s: string) => s.trim().replace(/\s+/g, ' ');
