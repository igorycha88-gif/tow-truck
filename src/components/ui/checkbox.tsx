import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Чекбокс согласия на ПД (152-ФЗ). Нативный input для accessibility.
const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, checked, ...props }, ref) => {
  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded border border-input bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 checked:border-accent checked:bg-accent"
        {...props}
      />
      <Check
        className={cn(
          'pointer-events-none h-3.5 w-3.5 text-accent-foreground opacity-0 peer-checked:opacity-100',
          className,
        )}
        aria-hidden="true"
      />
    </span>
  );
});
Checkbox.displayName = 'Checkbox';

export { Checkbox };
