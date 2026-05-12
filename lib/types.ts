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
}

export type MaintenanceStatus = 'overdue' | 'warning' | 'ok' | 'no_data'

export function getMaintenanceStatus(eq: EquipmentStatus): MaintenanceStatus {
  if (!eq.current_reading || !eq.next_maintenance_interval) return 'no_data'
  if (eq.current_reading >= eq.next_maintenance_interval) return 'overdue'
  if (!eq.daily_avg || eq.daily_avg <= 0) return 'ok'
  const daysLeft = (eq.next_maintenance_interval - eq.current_reading) / eq.daily_avg
  if (daysLeft <= 15) return 'overdue'
  if (daysLeft <= 30) return 'warning'
  return 'ok'
}

export function getDaysUntilMaintenance(eq: EquipmentStatus): number | null {
  if (!eq.current_reading || !eq.next_maintenance_interval || !eq.daily_avg || eq.daily_avg <= 0) return null
  return Math.round((eq.next_maintenance_interval - eq.current_reading) / eq.daily_avg)
}

export function formatReading(value: number | null, type: TrackingType): string {
  if (value === null || value === undefined) return '-'
  if (type === 'hours') return `${value.toLocaleString('pt-BR')}h`
  return `${value.toLocaleString('pt-BR')} km`
}
