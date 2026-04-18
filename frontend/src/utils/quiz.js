const TYPE_ALIAS_MAP = {
  choice: 'choice',
  single: 'choice',
  single_choice: 'choice',
  singlechoice: 'choice',
  choice_question: 'choice',
  radio: 'choice',
  select: 'choice',
  选择题: 'choice',
  单选题: 'choice',
  multiple_choice: 'multiple_choice',
  multiplechoice: 'multiple_choice',
  multiple: 'multiple_choice',
  multi: 'multiple_choice',
  checkbox: 'multiple_choice',
  多选题: 'multiple_choice',
  fill: 'fill',
  blank: 'fill',
  fill_blank: 'fill',
  fillblank: 'fill',
  completion: 'fill',
  填空题: 'fill',
  judge: 'judge',
  judgement: 'judge',
  judgment: 'judge',
  true_false: 'judge',
  truefalse: 'judge',
  boolean: 'judge',
  tf: 'judge',
  判断题: 'judge',
  essay: 'essay',
  short_answer: 'essay',
  shortanswer: 'essay',
  qa: 'essay',
  简答题: 'essay',
  calculation: 'calculation',
  calculate: 'calculation',
  math: 'calculation',
  计算题: 'calculation',
  comprehensive: 'comprehensive',
  analysis: 'comprehensive',
  synthesis: 'comprehensive',
  综合题: 'comprehensive',
  composition: 'composition',
  writing: 'composition',
  作文题: 'composition',
};

const OPTION_VALUE_FIELDS = ['value', 'key', 'id'];
const OPTION_TEXT_FIELDS = ['text', 'content', 'label', 'name'];

const normalizeOptionObject = (rawOption) => {
  if (!rawOption || typeof rawOption !== 'object' || Array.isArray(rawOption)) {
    return [];
  }

  const optionValueField = OPTION_VALUE_FIELDS.find(
    (field) => rawOption[field] !== undefined && rawOption[field] !== null
  );
  const optionTextField = OPTION_TEXT_FIELDS.find(
    (field) => rawOption[field] !== undefined && rawOption[field] !== null
  );

  if (optionValueField || optionTextField) {
    const value = optionValueField ? String(rawOption[optionValueField]).trim().toUpperCase() : '';
    const text = optionTextField ? String(rawOption[optionTextField]).trim() : '';

    if (!value && !text) {
      return [];
    }

    return [
      {
        ...rawOption,
        ...(value ? { value } : {}),
        ...(text ? { text } : {}),
      },
    ];
  }

  return Object.entries(rawOption)
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim())
    .sort(([leftKey], [rightKey]) => String(leftKey).localeCompare(String(rightKey)))
    .map(([key, value]) => ({
      value: String(key).trim().toUpperCase(),
      text: String(value).trim(),
    }));
};

const normalizeOptionItem = (rawOption) => {
  if (typeof rawOption === 'string') {
    const trimmed = rawOption.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof rawOption === 'object') {
    return normalizeOptionObject(rawOption);
  }

  if (rawOption === undefined || rawOption === null) {
    return [];
  }

  return [String(rawOption).trim()].filter(Boolean);
};

const normalizeOptions = (rawOptions) => {
  if (Array.isArray(rawOptions)) {
    return rawOptions.flatMap((item) => normalizeOptionItem(item));
  }

  if (typeof rawOptions === 'string') {
    const trimmed = rawOptions.trim();
    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return normalizeOptions(JSON.parse(trimmed));
      } catch {
        // Fall back to plain text parsing when the raw value is not valid JSON.
      }
    }

    return trimmed
      .split(/\r?\n|[;,，、]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (typeof rawOptions === 'object') {
    return normalizeOptionObject(rawOptions);
  }

  return [];
};

const normalizeChoiceAnswerToken = (rawToken) => {
  const trimmed = String(rawToken ?? '')
    .trim()
    .toUpperCase();

  if (!trimmed) {
    return '';
  }

  if (/^[A-Z]$/.test(trimmed)) {
    return trimmed;
  }

  const leadingTokenMatch = trimmed.match(/^[A-Z](?=[\s.)、．:：-]|$)/);
  if (leadingTokenMatch) {
    return leadingTokenMatch[0];
  }

  const tokenCandidates = trimmed.match(/[A-Z]/g) ?? [];
  return tokenCandidates.length === 1 ? tokenCandidates[0] : '';
};

const parseChoiceAnswerTokens = (rawAnswer) => {
  if (Array.isArray(rawAnswer)) {
    return [...new Set(rawAnswer.flatMap((item) => parseChoiceAnswerTokens(item)).filter(Boolean))];
  }

  if (rawAnswer && typeof rawAnswer === 'object') {
    return parseChoiceAnswerTokens(
      rawAnswer.answer ??
        rawAnswer.answers ??
        rawAnswer.value ??
        rawAnswer.correct_answer ??
        rawAnswer.correctAnswer ??
        ''
    );
  }

  const answerText = String(rawAnswer ?? '').trim();
  if (!answerText) {
    return [];
  }

  if (answerText.startsWith('[') || answerText.startsWith('{')) {
    try {
      return parseChoiceAnswerTokens(JSON.parse(answerText));
    } catch {
      // Fall back to text parsing when the raw value is not valid JSON.
    }
  }

  const normalizedText = answerText
    .toUpperCase()
    .replace(/[，、；/|+和与及]/g, ',');

  const splitTokens = normalizedText
    .split(/[,\s]+/)
    .map((item) => normalizeChoiceAnswerToken(item))
    .filter(Boolean);

  if (splitTokens.length > 0) {
    return [...new Set(splitTokens)];
  }

  const compactText = normalizedText.replace(/\s+/g, '');
  if (/^[A-Z]{2,6}$/.test(compactText) && !/^(TRUE|FALSE)$/.test(compactText)) {
    return [...new Set(compactText.split(''))];
  }

  const singleToken = normalizeChoiceAnswerToken(normalizedText);
  return singleToken ? [singleToken] : [];
};

const inferQuestionType = ({ type, options, answer }) => {
  const normalizedKey = String(type || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  const declaredType = TYPE_ALIAS_MAP[normalizedKey];
  const choiceAnswerTokens = options.length > 0 ? parseChoiceAnswerTokens(answer) : [];

  if (declaredType === 'choice' || declaredType === 'multiple_choice') {
    if (choiceAnswerTokens.length > 1) {
      return 'multiple_choice';
    }

    if (choiceAnswerTokens.length === 1) {
      return 'choice';
    }

    return declaredType;
  }

  if (declaredType) {
    return declaredType;
  }

  const answerText = String(answer || '').trim();

  if (options.length > 0) {
    return choiceAnswerTokens.length > 1 ? 'multiple_choice' : 'choice';
  }

  if (/^(true|false|正确|错误|对|错|√|×)$/i.test(answerText)) {
    return 'judge';
  }

  return 'fill';
};

export const normalizeQuizQuestion = (question = {}) => {
  const options = normalizeOptions(
    question.options ??
      question.choices ??
      question.option_list ??
      question.optionList ??
      question.selections
  );

  const answer =
    question.answer ??
    question.correct_answer ??
    question.correctAnswer ??
    question.solution ??
    '';

  const normalizedQuestion = question.question ?? question.stem ?? question.title ?? '';
  const normalizedType = inferQuestionType({
    type: question.type ?? question.question_type ?? question.kind,
    options,
    answer,
  });

  return {
    ...question,
    question: normalizedQuestion,
    stem: question.stem ?? normalizedQuestion,
    answer,
    options,
    type: normalizedType,
  };
};

export const normalizeQuizQuestions = (questions = []) =>
  Array.isArray(questions) ? questions.map((item) => normalizeQuizQuestion(item)) : [];
