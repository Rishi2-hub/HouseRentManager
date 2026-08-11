export type Tab =
  | 'Dashboard'
  | 'Properties'
  | 'Tenants'
  | 'Bills'
  | 'Settings';

export type Floor = {
  id: string;
  name: string;
  address: string;
  photo_uri?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
};

export type Room = {
  id: string;
  floor_id: string;
  room_number: string;
  monthly_rent: number;
  status: 'vacant' | 'occupied';
  photo_uri?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
};

export type Tenant = {
  id: string;
  room_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  id_type: string;
  id_number: string;
  move_in_date: string;
  monthly_rent: number;
  advance_deposit: number;
  photo_uri?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
};

export type Bill = {
  id: string;
  tenant_id: string;
  bill_month: string;

  billing_mode:
    | 'full_month'
    | 'by_days';

  billed_days: number;
  month_days: number;
  rent: number;

  previous_electricity_unit: number;
  current_electricity_unit: number;
  electricity_rate: number;
  electricity: number;

  water: number;
  waste: number;
  additional: number;
  previous_due: number;
  advance_used: number;
  paid_amount: number;
  total: number;
  balance: number;

  status:
    | 'paid'
    | 'partial'
    | 'due';

  created_at: string;
  updated_at: string;
  sync_status: string;
};