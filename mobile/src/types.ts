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
}

export interface Contact {
  id: number;
  name: string | null;
  phone: string | null;
  email: string | null;
  wechat_qr: string | null;
}

// A row of v_suppliers.
export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
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
}
