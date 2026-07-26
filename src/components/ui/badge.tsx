import * as React from 'react';
import { cn } from '@/lib/utils';

// Бейдж (small pill). Используется в Hero/Services.
const Badge = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground',
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

export { Badge };
