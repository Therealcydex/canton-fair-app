// Shapes returned by the API (backend/controllers, schema v2).

export interface User {
  id: number;
  company_id: number | null;
  company_name: string | null;
  company_branch: string | null;
  name: string;
  username: string;
  level: string | null;
  role: string;
}

export interface Company {
  id: number;
  name: string;
  branch: string | null;
}

// A row of v_booths.
export interface Booth {
  id: number;
  booth_code: string;
  phase: number;
  hall: number;
  floor: number;
  letter: string | null;      // null with num_start: only the hall and floor are known ("9.1")
  num_start: number | null;
  num_end: number | null;
  category_id: number | null;
  category: string | null;
  section: string | null;
  sub_category: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  visited: number;
  comment: string | null;
  zone: string | null;        // D50: A (halls 1-8), B (9-13), C (14-16), D (17-21)
}

export interface Contact {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  wechat_qr: string | null; // scanned content (D34), a QR photo path (D33) or an older typed id
}

// A row of v_suppliers.
export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  cantonfair_url: string | null; // D42: the exhibitor's page on cantonfair.org.cn
  address: string | null;
  province_id: number | null;
  province: string | null;
  rating: number | null;
  notes: string | null;
  nbr_booths: number;
  booth_visit_pct: string | number | null;
  contacts_count?: number;
  products_count?: number;
  contacts?: Contact[];
}

export interface ShippingType {
  code: string;
  name: string;
}

// A row of v_products.
export interface Product {
  id: number;
  name: string;
  supplier_id: number | null;
  supplier_name: string | null;
  supplier_ref: string | null;
  price: string | null;
  unit: string | null;
  moq: number | null;
  shipping_type: string | null;
  shipping_name: string | null;
  shared_with: string | null;
  cover_url: string | null;
  booth_id: number | null;     // D43: the booth where it was found
  booth_code: string | null;
  booth_phase: number | null;
  images_count?: number;
  description?: string | null;
  // D38: the boss's decision (evening review)
  status: ProductStatus;
  decision_note: string | null;
  decided_at: string | null;      // "YYYY-MM-DD HH:MM:SS", the time at the fair
  decided_by_name: string | null;
  created_at: string;
  created_by_name: string | null;
}

export type ProductStatus = 'A_ETUDIER' | 'RETENU' | 'ECHANTILLON' | 'A_COMMANDER' | 'REJETE';

export interface ProductImage {
  id: number;
  image_url: string;
}

// GET /products/review (D38)
export interface Review {
  pending: Product[];
  counts: Record<ProductStatus, number>;
}
