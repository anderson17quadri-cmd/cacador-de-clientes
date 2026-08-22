// SQLite has no native Json/array column type (see prisma/schema.prisma),
// so a handful of fields are stored as JSON-encoded strings. These helpers
// keep the read/write boundary in one place instead of JSON.parse/stringify
// scattered across services.

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

type CompanyJsonFields = { photos: string | null; openingHours: string | null; rawData: string | null };
type DeserializedCompany<T> = Omit<T, keyof CompanyJsonFields> & {
  photos: string[];
  openingHours: Record<string, any> | null;
  rawData: any;
};

export function deserializeCompany<T extends CompanyJsonFields>(company: T): DeserializedCompany<T> {
  return {
    ...company,
    photos: parseJson<string[]>(company.photos, []),
    openingHours: parseJson<Record<string, any> | null>(company.openingHours, null),
    rawData: parseJson<any>(company.rawData, null),
  };
}

type SearchJsonFields = { sources: string | null };
type DeserializedSearch<T> = Omit<T, keyof SearchJsonFields> & { sources: string[] };

export function deserializeSearch<T extends SearchJsonFields>(search: T): DeserializedSearch<T> {
  return { ...search, sources: parseJson<string[]>(search.sources, []) };
}
