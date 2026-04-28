export interface User {
  id: string
  supabase_id: string
  email: string
  display_name: string | null
  created_at: string
}

export interface FinancialAccount {
  id: string
  owner_id: string
  institution_name: string | null
  account_name: string
  account_type: string
  account_class: 'asset' | 'liability'
  last_four: string | null
  current_balance: number | null
  credit_limit: number | null
  statement_due_day: number | null
  minimum_due: number | null
  apr: number | null
  utilization_percent: number | null
  is_manual: boolean
  is_shared_with_partner: boolean
  sync_status: 'pending' | 'ok' | 'error' | 'manual'
  last_synced_at: string | null
  created_at: string
}

export interface Transaction {
  id: string
  account_id: string
  loan_id?: string | null
  amount: number
  merchant_name: string | null
  description: string | null
  category: string | null
  transaction_date: string
  is_manual: boolean
  created_at: string
  is_paid_off?: boolean
  paycheck_number?: number | null
}

export interface Budget {
  id: string
  owner_id: string
  category: string
  amount: number
  month: number
  year: number
  created_at: string
  actual_spent: number
  remaining: number
  percent_used: number
}

export interface Goal {
  id: string
  owner_id: string
  name: string
  target_amount: number
  target_date: string | null
  linked_account_id: string | null
  created_at: string
  current_balance: number
  progress_percent: number
  estimated_completion_date: string | null
}

export interface Partnership {
  id: string
  requester_id: string
  partner_id: string | null
  invite_email: string
  status: 'pending' | 'active'
  created_at: string
  accepted_at: string | null
}

export interface ApiError {
  detail: string
}