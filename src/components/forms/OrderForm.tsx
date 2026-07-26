'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { orderSchema, type OrderSchemaInput } from '@/lib/validators/order';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { services } from '@/config/services';
import { cn } from '@/lib/utils';

type Status = 'idle' | 'submitting' | 'success' | 'error';

// OrderForm — клиентский компонент формы заявки (RHF + Zod + fetch).
// 152-ФЗ: обязательный чекбокс согласия на обработку ПД + ссылка на /politika.
export function OrderForm() {
  const [status, setStatus] = React.useState<Status>('idle');
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrderSchemaInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      name: '',
      phone: '',
      location: '',
      serviceType: 'light_vehicle',
      consent: false as unknown as true,
    },
  });

  // Предзаполнение услуги из ?service= (карточка услуги)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('service');
    if (slug && services.some((s) => s.slug === slug)) {
      setValue('serviceType', slug as OrderSchemaInput['serviceType']);
    }
  }, [setValue]);

  const onSubmit = handleSubmit(async (data) => {
    setStatus('submitting');
    setServerMessage(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.status === 201) {
        setStatus('success');
        reset();
        return;
      }

      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setStatus('error');
        setServerMessage(body.message || 'Слишком много заявок. Позвоните нам.');
      } else if (res.status === 400) {
        setStatus('error');
        setServerMessage('Проверьте правильность заполнения полей.');
      } else {
        setStatus('error');
        setServerMessage('Произошла ошибка. Попробуйте ещё раз или позвоните нам.');
      }
    } catch {
      setStatus('error');
      setServerMessage('Нет соединения с сервером. Позвоните нам.');
    }
  });

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-accent" />
        <h3 className="text-xl font-bold">Заявка принята!</h3>
        <p className="text-muted-foreground">
          Мы перезвоним вам в течение нескольких минут для уточнения деталей.
        </p>
        <Button variant="outline" onClick={() => setStatus('idle')}>
          Отправить ещё одну заявку
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" aria-label="Форма заявки на эвакуацию">
      <div className="space-y-1.5">
        <Label htmlFor="name">Ваше имя</Label>
        <Input
          id="name"
          placeholder="Иван"
          autoComplete="name"
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && <FieldError msg={errors.name.message} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone">Телефон</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+7 (999) 123-45-67"
          autoComplete="tel"
          inputMode="tel"
          aria-invalid={!!errors.phone}
          {...register('phone')}
        />
        {errors.phone && <FieldError msg={errors.phone.message} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location">Адрес или район подачи</Label>
        <Input
          id="location"
          placeholder="Например: МКАД 50 км, внешняя сторона"
          autoComplete="street-address"
          aria-invalid={!!errors.location}
          {...register('location')}
        />
        {errors.location && <FieldError msg={errors.location.message} />}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="serviceType">Тип услуги</Label>
        <select
          id="serviceType"
          className={cn(
            'flex h-12 w-full rounded-lg border border-input bg-background px-4 py-2 text-base text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
          aria-invalid={!!errors.serviceType}
          {...register('serviceType')}
        >
          {services.map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.title}
            </option>
          ))}
        </select>
        {errors.serviceType && <FieldError msg={errors.serviceType.message} />}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="consent" className="flex items-start gap-3 text-sm text-muted-foreground">
          <Checkbox id="consent" aria-invalid={!!errors.consent} {...register('consent')} />
          <span>
            Я согласен на обработку персональных данных и принимаю условия{' '}
            <a href="/politika" className="font-medium text-accent underline hover:no-underline" target="_blank" rel="noopener">
              политики конфиденциальности
            </a>
            .
          </span>
        </label>
        {errors.consent && <FieldError msg={errors.consent.message} />}
      </div>

      {status === 'error' && serverMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverMessage}</span>
        </div>
      )}

      <Button type="submit" size="lg" className="w-full gap-2" disabled={status === 'submitting'}>
        {status === 'submitting' ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" /> Отправляем…
          </>
        ) : (
          <>
            <Send className="h-5 w-5" /> Отправить заявку
          </>
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Нажимая кнопку, вы даёте согласие на обработку персональных данных.
      </p>
    </form>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p role="alert" className="text-sm font-medium text-destructive">
      {msg}
    </p>
  );
}
