export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  avatarUrl?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  theme?: 'light' | 'dark' | 'system';
  emailNotifications?: boolean;
  searchNotifications?: boolean;
  defaultRadius?: number;
  defaultCountry?: string;
}

export interface Company {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  tiktok?: string | null;
  youtube?: string | null;
  address?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsLink?: string | null;
  openingHours?: Record<string, any> | null;
  rating?: number | null;
  totalRatings?: number | null;
  photos: string[];
  isOpen?: boolean | null;
  hasWebsite: boolean;
  hasInstagram: boolean;
  hasFacebook: boolean;
  hasWhatsapp: boolean;
  hasEmail: boolean;
  source: string;
  sourceId?: string | null;
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EnrichedCompany extends Company {
  enrichedData?: EnrichedData | null;
}

export interface EnrichedData {
  id: string;
  companyId: string;
  qualityScore: number;
  presenceLevel: 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'EXCELLENT';
  hasVisualIdentity: boolean;
  hasModernWebsite: boolean;
  instagramActive: boolean;
  postsFrequently: boolean;
  hasFewRatings: boolean;
  needsMarketing: boolean;
  needsAutomation: boolean;
  needsChatbot: boolean;
  needsNewWebsite: boolean;
  needsPaidTraffic: boolean;
  analysisText: string;
  enrichedAt: string;
}

export interface Search {
  id: string;
  userId: string;
  query: string;
  location: string;
  category: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  radius: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  totalFound: number;
  totalEnriched: number;
  progress: number;
  estimatedTime?: number | null;
  error?: string | null;
  sources: string[];
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchDTO {
  category: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  sources?: string[];
}

export interface DashboardStats {
  totalCompanies: number;
  withInstagram: number;
  withoutInstagram: number;
  withWebsite: number;
  withoutWebsite: number;
  withWhatsapp: number;
  withoutWhatsapp: number;
  withEmail: number;
  withoutEmail: number;
  averageRating?: number | null;
  totalRated: number;
}

export interface LeadStats {
  totalLeads: number;
  premiumLeads: number;
  leadsWithoutInstagram: number;
  leadsWithoutWebsite: number;
  leadsWithoutWhatsapp: number;
  averageRating?: number | null;
  totalSearches: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: UserProfile;
}

export type ExportFormat = 'CSV' | 'EXCEL' | 'PDF' | 'JSON';

export interface ExportRecord {
  id: string;
  userId: string;
  searchId?: string | null;
  format: ExportFormat;
  fileName: string;
  fileSize?: number | null;
  fileUrl?: string | null;
  filters?: Record<string, any> | null;
  status: string;
  createdAt: string;
  completedAt?: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  data?: Record<string, any> | null;
  createdAt: string;
}
