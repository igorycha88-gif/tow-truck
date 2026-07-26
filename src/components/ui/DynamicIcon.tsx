import * as React from 'react';
import {
  Car,
  Bike,
  Truck,
  CarFront,
  Siren,
  Clock,
  Timer,
  BadgeRussianRuble,
  ShieldCheck,
  LifeBuoy,
  PhoneCall,
  PackageCheck,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

// Маппинг имени иконки (из config) → компонент lucide-react.
// Дерево импортов tree-shake'ится, т.к. импортируем только нужное.
const ICONS: Record<string, LucideIcon> = {
  Car,
  Bike,
  Truck,
  CarFront,
  Siren,
  Clock,
  Timer,
  BadgeRussianRuble,
  ShieldCheck,
  LifeBuoy,
  PhoneCall,
  PackageCheck,
  Wallet,
};

export function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Car;
  return <Icon className={className} aria-hidden="true" />;
}
