'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapCompany {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  rating?: number | null;
  googleMapsLink?: string | null;
  category?: string | null;
}

interface LeadsMapProps {
  companies: MapCompany[];
  height?: string;
  className?: string;
}

export default function LeadsMap({ companies, height = '500px', className }: LeadsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current || initialized.current) return;
    if (companies.length === 0) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const bounds = L.latLngBounds([]);
    const validCompanies = companies.filter((c) => c.latitude && c.longitude);

    for (const company of validCompanies) {
      const latLng = L.latLng(company.latitude, company.longitude);
      bounds.extend(latLng);

      const popupHtml = `
        <div style="min-width:180px;font-family:system-ui,sans-serif;">
          <strong style="font-size:14px;">${escapeHtml(company.name)}</strong>
          ${company.category ? `<br/><span style="color:#6b7280;font-size:12px;">${escapeHtml(company.category)}</span>` : ''}
          ${company.rating ? `<br/><span style="color:#f59e0b;font-size:12px;">★ ${company.rating}</span>` : ''}
          ${company.googleMapsLink ? `
            <br/>
            <a href="${escapeHtml(company.googleMapsLink)}" target="_blank" rel="noopener"
               style="display:inline-block;margin-top:6px;padding:4px 10px;background:#7c3aed;color:#fff;border-radius:6px;text-decoration:none;font-size:12px;">
              Ver no Google Maps
            </a>
          ` : ''}
        </div>`;

      L.marker(latLng, { icon: defaultIcon }).addTo(map).bindPopup(popupHtml);
    }

    if (validCompanies.length > 0) {
      if (validCompanies.length === 1) {
        map.setView(bounds.getCenter(), 15);
      } else {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
    }

    mapRef.current = map;
    initialized.current = true;

    return () => {
      map.remove();
      mapRef.current = null;
      initialized.current = false;
    };
  }, [companies]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: '0.75rem' }}
      className={className}
    />
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
