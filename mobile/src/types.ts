// Shapes returned by the API (backend/controllers).

export interface User {
  id: number;
  company_id: number;
  company_name: string;
  name: string;
  username: string;
  level: number;
  role: string;
}

export type VisitStatus = 'prevu' | 'visite' | 'annule';

export interface Booth {
  id: number;
  supplier_id: number;
  supplier_name: string;
  category_id: number | null;
  category_name: string | null;
  phase: number | null;
  hall: number;
  level: number | null;
  letter: string | null;
  num_start: number;
  num_end: number;
  to_visit: number;
  comment: string | null;
  location: string;
  visits_count: number;
  products_count: number;
  last_status: VisitStatus | null;
  last_visited_at: string | null;
}

export interface Visit {
  id: number;
  user_id: number;
  user_name: string;
  visited_at: string | null;
  status: VisitStatus;
  comment: string | null;
}

export interface Contact {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  wechat_qr: string | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  province: string | null;
  rating: number | null;
  notes: string | null;
  contacts_count?: number;
  booths_count?: number;
  products_count?: number;
  contacts?: Contact[];
}

export interface Product {
  id: number;
  name: string;
  supplier_id: number;
  supplier_name: string;
  booth_id: number | null;
  booth_location: string | null;
  supplier_ref: string | null;
  price_tnd: string | null;
  unit: string | null;
  moq: number | null;
  incoterm: string | null;
  cover_url: string | null;
  own: boolean;
}
