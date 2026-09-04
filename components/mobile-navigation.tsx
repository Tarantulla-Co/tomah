'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function MobileNavigation({ links = [['Products', '#products'], ['About us', '#about'], ['How it works', '#how-it-works'], ['Maple shop', '/maple-shop']], actionLabel = 'Request a quote', actionHref = 'mailto:info@tomahinc.com?subject=Wholesale%20quote%20request' }: { links?: [string, string][]; actionLabel?: string; actionHref?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1101px)');
    const onResize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    desktop.addEventListener('change', onResize);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
      desktop.removeEventListener('change', onResize);
    };
  }, [open]);

  return <div className="mobile-navigation" ref={root} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <Button ref={trigger} variant="ghost" size="icon" className="menu-toggle" aria-label={open ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={open} aria-controls="mobile-navigation-links" onClick={() => setOpen(!open)}>
      {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
    </Button>
    <nav id="mobile-navigation-links" className="mobile-menu" aria-label="Mobile navigation" hidden={!open}>
      {links.map(([label, href]) => <a key={href} href={href} onClick={() => { setOpen(false); trigger.current?.focus(); }}>{label}</a>)}
      <a className="mobile-quote" href={actionHref} onClick={() => setOpen(false)}>{actionLabel}</a>
    </nav>
  </div>;
}
