import { useEffect, useState } from 'react';
import { ensureIconfontLoaded } from './iconfontLoader.js';

export default function IconFontSymbol({ name, className = '', fallback = null, title }) {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    ensureIconfontLoaded(import.meta.env.VITE_ICONFONT_URL).then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setStatus('unavailable');
        return;
      }

      setStatus(document.getElementById(name) ? 'ready' : 'missing');
    });

    return () => {
      cancelled = true;
    };
  }, [name]);

  if (status !== 'ready') return fallback;

  return (
    <svg aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} className={className}>
      {title ? <title>{title}</title> : null}
      <use href={`#${name}`} />
    </svg>
  );
}
