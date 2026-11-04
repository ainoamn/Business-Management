import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Button({className = '', ...props}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}
export function Card({children, className = ''}: PropsWithChildren<{className?: string}>) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function StatusBadge({up, children}: PropsWithChildren<{up: boolean}>) {
  return <span className={`badge ${up ? 'badge-up' : 'badge-down'}`}><span aria-hidden="true">●</span><span>{children}</span></span>;
}
