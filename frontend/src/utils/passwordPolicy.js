const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 50;
const STRONG_PASSWORD_MIN_LENGTH = 8;

const LOWERCASE_RE = /[a-z]/;
const UPPERCASE_RE = /[A-Z]/;
const DIGIT_RE = /\d/;
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
const WHITESPACE_RE = /\s/;

export function validatePasswordForSubmission(password) {
  if (!password) return '请输入密码';
  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return `密码长度必须在 ${MIN_PASSWORD_LENGTH} 到 ${MAX_PASSWORD_LENGTH} 位之间`;
  }
  if (WHITESPACE_RE.test(password)) {
    return '密码不能包含空格';
  }
  return null;
}

export function getPasswordStrength(password) {
  if (!password) {
    return {
      level: 0,
      text: '',
      colorClass: '',
      bgClass: '',
      bars: [],
      hint: '',
    };
  }

  const typeCount = [
    LOWERCASE_RE.test(password),
    UPPERCASE_RE.test(password),
    DIGIT_RE.test(password),
    SPECIAL_RE.test(password),
  ].filter(Boolean).length;

  if (password.length >= STRONG_PASSWORD_MIN_LENGTH && typeCount === 4) {
    return {
      level: 3,
      text: '强',
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-500',
      bars: [1, 2, 3],
      hint: '当前是强密码。',
    };
  }

  if (password.length >= STRONG_PASSWORD_MIN_LENGTH && typeCount >= 2) {
    return {
      level: 2,
      text: '中',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-500',
      bars: [1, 2],
      hint: '当前是中等强度密码，建议继续增加字符种类。',
    };
  }

  if (validatePasswordForSubmission(password) === null) {
    return {
      level: 1,
      text: '弱',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-500',
      bars: [1],
      hint: '当前是弱密码，虽然可以提交，但建议增强复杂度。',
    };
  }

  return {
    level: 0,
    text: '过短',
    colorClass: 'text-slate-400',
    bgClass: 'bg-slate-300',
    bars: [],
    hint: `密码至少需要 ${MIN_PASSWORD_LENGTH} 位，且不能包含空格。`,
  };
}

export function isStrongPassword(password) {
  return getPasswordStrength(password).level === 3;
}
