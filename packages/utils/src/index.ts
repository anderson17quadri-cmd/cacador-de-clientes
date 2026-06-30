export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

export function formatCNPJ(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length === 14) {
    return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`;
  }
  return cnpj;
}

export function truncate(str: string, length: number): string {
  if (!str) return '';
  return str.length > length ? str.slice(0, length) + '...' : str;
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('pt-BR').format(num);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const past = new Date(date).getTime();
  const diffMs = now - past;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'agora mesmo';
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHour < 24) return `${diffHour}h atrás`;
  if (diffDay < 30) return `${diffDay}d atrás`;
  if (diffMonth < 12) return `${diffMonth}m atrás`;
  return `${diffYear}a atrás`;
}

export function getRatingColor(rating: number): string {
  if (rating >= 4.5) return 'text-green-500';
  if (rating >= 4.0) return 'text-green-400';
  if (rating >= 3.0) return 'text-yellow-500';
  if (rating >= 2.0) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  if (score >= 20) return 'bg-orange-500';
  return 'bg-red-500';
}

export function getPresenceLabel(level: string): string {
  const map: Record<string, string> = {
    VERY_LOW: 'Muito Baixa',
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    EXCELLENT: 'Excelente',
  };
  return map[level] || level;
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pendente',
    RUNNING: 'Em andamento',
    COMPLETED: 'Concluída',
    FAILED: 'Falhou',
    CANCELLED: 'Cancelada',
  };
  return map[status] || status;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function generateRandomId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export const BRAZILIAN_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

export const BUSINESS_CATEGORIES = [
  { value: 'barbearia', label: 'Barbearia', icon: 'Scissors' },
  { value: 'dentista', label: 'Dentista', icon: 'Stethoscope' },
  { value: 'restaurante', label: 'Restaurante', icon: 'UtensilsCrossed' },
  { value: 'padaria', label: 'Padaria', icon: 'Croissant' },
  { value: 'hotel', label: 'Hotel', icon: 'Building2' },
  { value: 'advogado', label: 'Advogado', icon: 'Scale' },
  { value: 'academia', label: 'Academia', icon: 'Dumbbell' },
  { value: 'veterinario', label: 'Veterinário', icon: 'Heart' },
  { value: 'clinica', label: 'Clínica', icon: 'Hospital' },
  { value: 'farmacia', label: 'Farmácia', icon: 'Pill' },
  { value: 'loja', label: 'Loja', icon: 'Store' },
  { value: 'construtora', label: 'Construtora', icon: 'HardHat' },
  { value: 'imobiliaria', label: 'Imobiliária', icon: 'Home' },
  { value: 'mecanica', label: 'Mecânica', icon: 'Wrench' },
  { value: 'supermercado', label: 'Supermercado', icon: 'ShoppingCart' },
  { value: 'pet_shop', label: 'Pet Shop', icon: 'PawPrint' },
  { value: 'escola', label: 'Escola', icon: 'GraduationCap' },
  { value: 'contabilidade', label: 'Contabilidade', icon: 'Calculator' },
  { value: 'transporte', label: 'Transporte', icon: 'Truck' },
  { value: 'eventos', label: 'Eventos', icon: 'PartyPopper' },
];

export const SEARCH_RADIUS_OPTIONS = [
  { value: 1000, label: '1 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: 20000, label: '20 km' },
  { value: 50000, label: '50 km' },
  { value: 100000, label: '100 km' },
];
