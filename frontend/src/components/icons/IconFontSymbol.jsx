import { useEffect, useState } from 'react';
import { ensureIconfontLoaded } from './iconfontLoader.js';

export default function IconFontSymbol({ name, className = '', fallback = null, title }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureIconfontLoaded(import.meta.env.VITE_ICONFONT_URL).then(setReady);
  }, []);

  if (!ready) return fallback;

  return (
    <svg aria-hidden="true" role={title ? 'img' : undefined} className={className}>
      {title ? <title>{title}</title> : null}
      <use href={`#${name}`} />
    </svg>
  );
}
