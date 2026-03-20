const loaded = new Map();

export function ensureIconfontLoaded(url) {
  if (!url) return Promise.resolve(false);
  if (loaded.has(url)) return loaded.get(url);

  const promise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  loaded.set(url, promise);
  return promise;
}
