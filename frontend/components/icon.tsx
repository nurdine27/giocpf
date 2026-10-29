import type { HTMLAttributes } from 'react';
/** GIO icon system: use the locally bundled Material Symbols font. */
export function Icon({
  name,
  className = '',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { name: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols ${className}`} {...props}>
      {name}
    </span>
  );
}
