const ABSOLUTE_PROTOCOL_PATTERN = /^(?:https?:)?\/\//i;
const SPECIAL_PROTOCOL_PATTERN = /^(?:mailto|tel):/i;
const ROOT_RELATIVE_PATTERN = /^(?:\/|#|\?)/;
const BARE_DOMAIN_PATTERN =
  /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s]*)?$/i;

const TRAILING_PUNCTUATION_PATTERN = /[),.;!?]$/;
const LINK_PLACEHOLDER_PREFIX = '__ZHIXUEBAN_LINK_TOKEN__';
const PROTECTED_SEGMENT_PATTERNS = [
  /```[\s\S]*?```/g,
  /`[^`\n]+`/g,
  /!?\[[^\]]*]\([^)]+\)/g,
  /<a\b[\s\S]*?<\/a>/gi,
];
const PLAIN_URL_PATTERN =
  /(^|[\s>（(\[【])((?:https?:\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s<]*)?)/gim;

export const normalizeHref = (href = '') => {
  const value = String(href || '').trim();
  if (!value) return '';
  if (ABSOLUTE_PROTOCOL_PATTERN.test(value) || SPECIAL_PROTOCOL_PATTERN.test(value) || ROOT_RELATIVE_PATTERN.test(value)) {
    return value;
  }
  if (BARE_DOMAIN_PATTERN.test(value)) {
    return `https://${value}`;
  }
  return value;
};

export const isExternalHref = (href = '') => {
  const normalized = normalizeHref(href);
  if (!normalized || SPECIAL_PROTOCOL_PATTERN.test(normalized) || ROOT_RELATIVE_PATTERN.test(normalized)) {
    return false;
  }

  if (!ABSOLUTE_PROTOCOL_PATTERN.test(normalized)) {
    return false;
  }

  if (typeof window === 'undefined') {
    return true;
  }

  try {
    return new URL(normalized, window.location.origin).origin !== window.location.origin;
  } catch {
    return true;
  }
};

export const getAnchorProps = (href = '') => {
  const normalizedHref = normalizeHref(href);
  return isExternalHref(normalizedHref)
    ? { href: normalizedHref, target: '_blank', rel: 'noopener noreferrer' }
    : { href: normalizedHref };
};

const protectSegments = (content, placeholders) => {
  let protectedContent = content;
  PROTECTED_SEGMENT_PATTERNS.forEach((pattern) => {
    protectedContent = protectedContent.replace(pattern, (segment) => {
      const token = `${LINK_PLACEHOLDER_PREFIX}${placeholders.length}__`;
      placeholders.push(segment);
      return token;
    });
  });
  return protectedContent;
};

const restoreSegments = (content, placeholders) =>
  placeholders.reduce(
    (result, segment, index) => result.replace(`${LINK_PLACEHOLDER_PREFIX}${index}__`, segment),
    content
  );

const trimTrailingPunctuation = (rawUrl) => {
  let url = rawUrl;
  let suffix = '';

  while (url && TRAILING_PUNCTUATION_PATTERN.test(url)) {
    suffix = `${url.slice(-1)}${suffix}`;
    url = url.slice(0, -1);
  }

  return { url, suffix };
};

export const linkifyPlainUrls = (content = '') => {
  if (!content) return content;

  const placeholders = [];
  const protectedContent = protectSegments(content, placeholders);
  const linkifiedContent = protectedContent.replace(PLAIN_URL_PATTERN, (match, prefix, rawUrl) => {
    const { url, suffix } = trimTrailingPunctuation(rawUrl);
    const normalizedHref = normalizeHref(url);
    if (!normalizedHref || !ABSOLUTE_PROTOCOL_PATTERN.test(normalizedHref)) {
      return match;
    }
    return `${prefix}[${url}](${normalizedHref})${suffix}`;
  });

  return restoreSegments(linkifiedContent, placeholders);
};
