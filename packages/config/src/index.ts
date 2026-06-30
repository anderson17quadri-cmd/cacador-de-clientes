export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const APP_CONFIG = {
  name: 'LeadHunter AI',
  description: 'Plataforma SaaS para prospecção de clientes com IA',
  version: '1.0.0',
  apiBaseUrl: API_BASE_URL,
  defaultRadius: 5000,
  maxRadius: 100000,
  resultsPerPage: 20,
  maxResultsPerPage: 100,
  maxExportRows: 50000,
  mapDefaultCenter: { lat: -23.5505, lng: -46.6333 },
  mapDefaultZoom: 13,
  refreshInterval: 5000,
  debounceDelay: 300,
};

export const GOOGLE_MAPS_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || '',
  defaultZoom: 13,
  styles: [
    {
      featureType: 'poi.business',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

export const CHART_COLORS = {
  primary: '#7c3aed',
  secondary: '#06b6d4',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  gray: '#6b7280',
  purple: '#a855f7',
  pink: '#ec4899',
  teal: '#14b8a6',
};

export const CHART_COLORS_ARRAY = [
  '#7c3aed', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444',
  '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];
