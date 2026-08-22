// SQLite has no native enum type, so schema.prisma stores these as plain
// Strings. These const objects replace the old `@prisma/client` enum
// imports and keep the same `UserRole.ADMIN`-style call sites working.

export const UserRole = {
  USER: 'USER',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const PlanType = {
  FREE: 'FREE',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type PlanType = (typeof PlanType)[keyof typeof PlanType];

export const SearchStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;
export type SearchStatus = (typeof SearchStatus)[keyof typeof SearchStatus];

export const PresenceLevel = {
  VERY_LOW: 'VERY_LOW',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  EXCELLENT: 'EXCELLENT',
} as const;
export type PresenceLevel = (typeof PresenceLevel)[keyof typeof PresenceLevel];

export const ExportFormat = {
  CSV: 'CSV',
  EXCEL: 'EXCEL',
  PDF: 'PDF',
  JSON: 'JSON',
} as const;
export type ExportFormat = (typeof ExportFormat)[keyof typeof ExportFormat];
