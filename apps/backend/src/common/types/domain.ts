export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const SearchStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type SearchStatus = (typeof SearchStatus)[keyof typeof SearchStatus];

export const ExportFormat = {
  CSV: 'CSV',
  EXCEL: 'EXCEL',
  PDF: 'PDF',
  JSON: 'JSON',
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];

export const PresenceLevel = {
  VERY_LOW: 'VERY_LOW',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  EXCELLENT: 'EXCELLENT',
} as const;
export type PresenceLevel = (typeof PresenceLevel)[keyof typeof PresenceLevel];
