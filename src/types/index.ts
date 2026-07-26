// Общие типы проекта (см. ARCHITECTURE.md §5)

export type ServiceType =
  | 'light_vehicle'
  | 'moto'
  | 'commercial'
  | 'offroad'
  | 'accident';

export type OrderStatus = 'NEW' | 'CALLED' | 'DONE' | 'CANCELLED';

export const SERVICE_TYPES: readonly ServiceType[] = [
  'light_vehicle',
  'moto',
  'commercial',
  'offroad',
  'accident',
] as const;

// Модель цены услуги: фиксированный тариф (подача + ₽/км) либо «по запросу».
export type ServicePricing =
  | { kind: 'tariff'; baseFee: number; perKm: number }
  | { kind: 'onRequest' };

export type ServiceCatalogItem = {
  slug: ServiceType;
  title: string;
  description: string;
  pricing: ServicePricing;
  icon: string; // имя иконки lucide-react
};

export type AdvantageItem = {
  id: string;
  icon: string;
  title: string;
  text: string;
};

export type ProcessStep = {
  step: number;
  title: string;
  text: string;
  icon: string;
};

export type CompanyInfo = {
  name: string;
  legalName: string;
  inn: string;
  phone: string; // человекочитаемый
  phoneHref: string; // tel:+74950000000
  whatsapp?: string;
  telegram?: string;
  email?: string; // человекочитаемый (необязательный — задавать через NEXT_PUBLIC_EMAIL)
  emailHref?: string; // mailto:...
  address: string;
  workingHours: string;
  domain: string;
};

export type OrderInput = {
  name: string;
  phone: string;
  location: string;
  serviceType: ServiceType;
  consent: true;
};

export type OrderRecord = {
  id: string;
  name: string;
  phone: string;
  location: string;
  serviceType: ServiceType;
  status: OrderStatus;
  source: string;
  ip: string | null;
  createdAt: Date;
  updatedAt: Date;
};
