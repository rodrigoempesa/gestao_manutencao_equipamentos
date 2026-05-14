export type Role = 'admin_geral' | 'admin_local' | 'encarregado'
export type TrackingType = 'hours' | 'km'

export interface Branch {
  id: string
  name: string
  city: string
  state: string
  active: boolean
  created_at: string
}

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  branch_id: string | null
  active: boolean
  created_at: string
  updated_at: string
  branches?: Branch
}

export interface Brand {
  id: string
  name: string
  created_at: string
}

export interface EquipmentModel {
  id: string
  brand_id: string
  name: string
  tracking_type: TrackingType
  created_at: string
  brands?: Brand
}

export interface MaintenancePlan {
  id: string
  model_id: string
  interval_value: number
  name: string
  description: string | null
  created_at: string
  equipment_models?: EquipmentModel
  maintenance_plan_items?: MaintenancePlanItem[]
}

export interface MaintenancePlanItem {
  id: string
  plan_id: string
  description: string
  order_index: number
  created_at: string
}

export interface Equipment {
  id: string
  code: string
  name: string
  model_id: string
  branch_id: string
  year: number | null
  serial_number: string | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
  equipment_models?: EquipmentModel & { brands?: Brand }
  branches?: Branch
}

export interface Reading {
  id: string
  equipment_id: string
  reading_value: number
  reading_date: string
  notes: string | null
  created_by: string | null
  created_at: string
  equipment?: Equipment
  profiles?: Profile
}

export interface MaintenanceRecord {
  id: string
  equipment_id: string
  plan_id: string | null
  reading_at_maintenance: number
  maintenance_date: string
  performed_by: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  equipment?: Equipment
  maintenance_plans?: MaintenancePlan
  profiles?: Profile
}

export interface EquipmentStatus {
  id: string
  code: string
  name: string
  active: boolean
  branch_id: string
  branch_name: string
  branch_city: string
  branch_state: string
  model_id: string
  model_name: string
  tracking_type: TrackingType
  brand_id: string
  brand_name: string
  current_reading: number | null
  last_reading_date: string | null
  daily_avg: number | null
  last_maintenance_date: string | null
  last_maintenance_reading: number | null
  last_maintenance_interval: number | null
  last_maintenance_plan_name: string | null
  next_maintenance_interval: number | null
  next_maintenance_plan_name: string | null
  next_maintenance_threshold: number | null
  upcoming_maintenance_interval: number | null
  upcoming_maintenance_plan_name: string | null
  upcoming_maintenance_threshold: number | null
  accumulated_since_maintenance: number | null
}

export type MaintenanceStatus = 'overdue' | 'warning' | 'ok' | 'no_data'

// Uses the adjusted threshold (accounts for late services) rather than
// the raw plan interval_value, so delays propagate forward correctly.
export function getMaintenanceStatus(eq: EquipmentStatus): MaintenanceStatus {
  const threshold = eq.next_maintenance_threshold
  if (!eq.current_reading || !threshold) return 'no_data'
  if (eq.current_reading >= threshold) return 'overdue'
  if (!eq.daily_avg || eq.daily_avg <= 0) return 'ok'
  const daysLeft = (threshold - eq.current_reading) / eq.daily_avg
  if (daysLeft <= 15) return 'overdue'
  if (daysLeft <= 30) return 'warning'
  return 'ok'
}

export function getDaysUntilMaintenance(eq: EquipmentStatus): number | null {
  const threshold = eq.next_maintenance_threshold
  if (!eq.current_reading || !threshold || !eq.daily_avg || eq.daily_avg <= 0) return null
  return Math.round((threshold - eq.current_reading) / eq.daily_avg)
}

// Returns info about the upcoming (next-next) service when the equipment is
// overdue for the current service but already approaching the one after it.
// Triggers when the reading has crossed ≥50% of the gap between the two thresholds.
export function getUpcomingWarning(eq: EquipmentStatus): {
  planName: string
  threshold: number
  remaining: number
} | null {
  if (!eq.current_reading || !eq.next_maintenance_threshold) return null
  if (eq.current_reading < eq.next_maintenance_threshold) return null // not overdue
  if (!eq.upcoming_maintenance_threshold || !eq.upcoming_maintenance_plan_name) return null

  const gap = eq.upcoming_maintenance_threshold - eq.next_maintenance_threshold
  if (gap <= 0) return null

  const passed = eq.current_reading - eq.next_maintenance_threshold
  if (passed / gap < 0.5) return null // not yet halfway to the next service

  return {
    planName: eq.upcoming_maintenance_plan_name,
    threshold: eq.upcoming_maintenance_threshold,
    remaining: eq.upcoming_maintenance_threshold - eq.current_reading,
  }
}

export function formatReading(value: number | null, type: TrackingType): string {
  if (value === null || value === undefined) return '-'
  if (type === 'hours') return `${value.toLocaleString('pt-BR')}h`
  return `${value.toLocaleString('pt-BR')} km`
}
