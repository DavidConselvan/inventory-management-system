export type Unit = 'KG' | 'G' | 'L' | 'ML' | 'UNIT';

export const UNIT_OPTIONS: { value: Unit; label: string }[] = [
  { value: 'UNIT', label: 'Unit' },
  { value: 'KG', label: 'Kilogram (kg)' },
  { value: 'G', label: 'Gram (g)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'ML', label: 'Milliliter (mL)' },
];

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Product {
  id: number;
  name: string;
  description: string;
  sku: string;
  unit: Unit;
  created_at: string;
  updated_at: string;
}

export interface Financials {
  purchased_quantity: string;
  purchased_cost: string;
  sold_quantity: string;
  revenue: string;
  cogs: string;
  profit: string;
  margin_percent: string | null;
  quantity_on_hand: string;
  inventory_value: string;
}

export interface PurchaseOrderItem {
  id?: number;
  product: number;
  product_name?: string;
  quantity: string;
  unit_cost: string;
  line_total?: string;
}

export interface PurchaseOrder {
  id: number;
  reference: string;
  supplier: string;
  order_date: string;
  status: 'DRAFT' | 'RECEIVED';
  notes: string;
  items: PurchaseOrderItem[];
  total_cost: string;
  created_at: string;
}

export interface SalesOrderItem {
  id?: number;
  product: number;
  product_name?: string;
  quantity: string;
  unit_price: string;
  revenue?: string;
  cogs?: string;
  profit?: string;
}

export interface SalesOrder {
  id: number;
  reference: string;
  customer: string;
  order_date: string;
  status: 'DRAFT' | 'CONFIRMED';
  notes: string;
  items: SalesOrderItem[];
  total_revenue: string;
  total_cogs: string;
  total_profit: string;
  created_at: string;
}

export interface StockLot {
  id: number;
  product: number;
  product_name: string;
  lot_code: string;
  source_item: number | null;
  unit_cost: string;
  quantity_received: string;
  quantity_remaining: string;
  quantity_consumed: string;
  remaining_value: string;
  received_date: string;
  created_at: string;
}

export interface ProductFinancialRow extends Financials {
  id: number;
  name: string;
  sku: string;
  unit: Unit;
}

export interface Dashboard {
  totals: Financials;
  products: ProductFinancialRow[];
  product_count: number;
  purchase_order_count: number;
  sales_order_count: number;
}
