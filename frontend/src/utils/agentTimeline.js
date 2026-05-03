const buildUserMessageId = (turnIndex) => `user-${turnIndex}`;
const buildAssistantMessageId = (turnIndex) => `assistant-${turnIndex}`;

const hasOwn = (value, key) => Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const tryParseJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^[{\[]/.test(trimmed)) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeToolOutput = (content, extra = {}) => {
  const candidates = [extra?.result, extra?.output_result, content];
  for (const candidate of candidates) {
    const normalized = tryParseJson(candidate);
    if (normalized !== undefined && normalized !== null) {
      return normalized;
    }
  }
  return null;
};

const inferToolStatus = (result, extra = {}) => {
  for (const candidate of [result, extra]) {
    if (candidate && typeof candidate === 'object' && hasOwn(candidate, 'success')) {
      return candidate.success ? 'success' : 'failed';
    }
  }

  for (const candidate of [result, extra]) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    if (candidate.error || candidate.provider_search_error) {
      return 'failed';
    }

    if (['text', 'summary', 'answer', 'message'].some((key) => typeof candidate?.[key] === 'string' && candidate[key].trim())) {
      return 'success';
    }

    if (Array.isArray(candidate?.results) && candidate.results.length) {
      return 'success';
    }

    if (Array.isArray(candidate?.evidence) && candidate.evidence.length) {
      return 'success';
    }

    if (typeof candidate?.count === 'number' && candidate.count > 0) {
      return 'success';
    }
  }

  if (typeof result === 'string') {
    return result.trim() ? 'success' : 'failed';
  }

  if (Array.isArray(result)) {
    return result.length ? 'success' : 'failed';
  }

  return 'failed';
};

const summarizeToolOutput = (result) => {
  if (!result) {
    return '';
  }

  const preferredKeys = ['text', 'summary', 'answer', 'error', 'message'];
  for (const key of preferredKeys) {
    const value = result?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim().slice(0, 240);
    }
  }

  if (typeof result === 'string') {
    return result.trim().slice(0, 240);
  }

  try {
    return JSON.stringify(result).slice(0, 240);
  } catch {
    return String(result).slice(0, 240);
  }
};

const ensureLegacyUserMessage = (timeline, session, currentTurnIndexRef) => {
  if (currentTurnIndexRef.value > 0) {
    return;
  }

  currentTurnIndexRef.value = 1;
  timeline.push({
    id: buildUserMessageId(1),
    role: 'user',
    turn_index: 1,
    content: session?.title || session?.goal || '',
    attachments: session?.context?.attachments || [],
    thinking: '',
    tool_uses: [],
    status: 'completed',
    created_at: session?.created_at || null,
  });
};

const ensureAssistantTurn = (timeline, session, currentTurnIndexRef, currentAssistantRef) => {
  ensureLegacyUserMessage(timeline, session, currentTurnIndexRef);
  if (
    currentAssistantRef.value &&
    currentAssistantRef.value.turn_index === currentTurnIndexRef.value
  ) {
    return currentAssistantRef.value;
  }

  const assistant = {
    id: buildAssistantMessageId(currentTurnIndexRef.value),
    role: 'assistant',
    turn_index: currentTurnIndexRef.value,
    content: '',
    attachments: [],
    thinking: '',
    tool_uses: [],
    status: 'in_progress',
    created_at: null,
    thinking_expanded: true,
  };
  timeline.push(assistant);
  currentAssistantRef.value = assistant;
  return assistant;
};

export const buildTimelineFromSteps = (session = {}) => {
  const steps = Array.isArray(session.steps) ? session.steps : [];
  const timeline = [];
  const currentTurnIndexRef = { value: 0 };
  const currentAssistantRef = { value: null };

  steps.forEach((step) => {
    const extra = step?.extra_data || {};

    if (step?.step_type === 'user_message') {
      currentTurnIndexRef.value = Number(extra?.turn_index) || currentTurnIndexRef.value + 1 || 1;
      currentAssistantRef.value = null;
      timeline.push({
        id: buildUserMessageId(currentTurnIndexRef.value),
        role: 'user',
        turn_index: currentTurnIndexRef.value,
        content: step.content || '',
        attachments: extra?.attachments || [],
        thinking: '',
        tool_uses: [],
        status: 'completed',
        created_at: step.created_at || null,
      });
      return;
    }

    if (step?.step_type === 'goal') {
      return;
    }

    const assistant = ensureAssistantTurn(
      timeline,
      session,
      currentTurnIndexRef,
      currentAssistantRef,
    );

    if (!assistant.created_at) {
      assistant.created_at = step.created_at || null;
    }

    if (step?.step_type === 'thought') {
      const nextThought = String(step.content || '').trim();
      assistant.thinking = assistant.thinking
        ? `${assistant.thinking}\n\n${nextThought}`.trim()
        : nextThought;
      return;
    }

    if (step?.step_type === 'action') {
      assistant.tool_uses.push({
        id: `${assistant.id}-tool-${assistant.tool_uses.length + 1}`,
        tool_name: extra?.tool_name || String(step.content || '').split(':')[0] || '工具',
        input: extra?.tool_input || {},
        output: null,
        output_summary: '',
        status: 'pending',
        created_at: step.created_at || null,
      });
      return;
    }

    if (step?.step_type === 'observation') {
      const output = normalizeToolOutput(step.content, extra);
      const outputSummary = summarizeToolOutput(output || extra);
      const outputStatus = inferToolStatus(output, extra);
      const latestTool = assistant.tool_uses[assistant.tool_uses.length - 1];

      if (latestTool) {
        latestTool.output = output;
        latestTool.output_summary = outputSummary;
        latestTool.status = outputStatus;
      } else {
        assistant.tool_uses.push({
          id: `${assistant.id}-tool-${assistant.tool_uses.length + 1}`,
          tool_name: extra?.tool_name || '工具',
          input: {},
          output,
          output_summary: outputSummary,
          status: outputStatus,
          created_at: step.created_at || null,
        });
      }
      return;
    }

    if (step?.step_type === 'final_answer') {
      assistant.content = step.content || '';
      assistant.status = 'completed';
      assistant.quality_status = extra?.quality_status;
      assistant.confidence = extra?.confidence;
      assistant.evidence = extra?.evidence || [];
      assistant.fallback_used = extra?.fallback_used || false;
      assistant.thinking_expanded = false;
    }
  });

  return timeline;
};

export const normalizeSession = (session = {}) => {
  const timeline = Array.isArray(session.timeline) && session.timeline.length
    ? session.timeline
    : buildTimelineFromSteps(session);

  return {
    ...session,
    title: session.title || session.goal || '新对话',
    timeline,
  };
};

export const buildOptimisticUserMessage = (message, attachments, turnIndex) => ({
  id: buildUserMessageId(turnIndex),
  role: 'user',
  turn_index: turnIndex,
  content: message,
  attachments: attachments || [],
  thinking: '',
  tool_uses: [],
  status: 'completed',
  created_at: new Date().toISOString(),
});

export const buildOptimisticAssistantMessage = (turnIndex) => ({
  id: buildAssistantMessageId(turnIndex),
  role: 'assistant',
  turn_index: turnIndex,
  content: '',
  attachments: [],
  thinking: '',
  tool_uses: [],
  status: 'in_progress',
  created_at: new Date().toISOString(),
  thinking_expanded: true,
});

export const getNextTurnIndex = (timeline = []) =>
  timeline.filter((item) => item.role === 'user').length + 1;

const ensureLatestAssistant = (timeline, turnIndex) => {
  const nextTimeline = [...timeline];
  let assistantIndex = -1;
  for (let index = nextTimeline.length - 1; index >= 0; index -= 1) {
    const item = nextTimeline[index];
    if (item.role === 'assistant' && item.turn_index === turnIndex) {
      assistantIndex = index;
      break;
    }
  }

  if (assistantIndex === -1) {
    nextTimeline.push(buildOptimisticAssistantMessage(turnIndex));
    assistantIndex = nextTimeline.length - 1;
  }

  return {
    nextTimeline,
    assistantIndex,
  };
};

export const applyStreamEventToTimeline = (timeline = [], eventPayload) => {
  const turnIndex = Number(eventPayload?.turn_index) || getNextTurnIndex(timeline) - 1 || 1;
  const { nextTimeline, assistantIndex } = ensureLatestAssistant(timeline, turnIndex);
  const assistant = { ...nextTimeline[assistantIndex] };
  nextTimeline[assistantIndex] = assistant;

  switch (eventPayload?.type) {
    case 'thought': {
      const nextThought = String(eventPayload.content || '').trim();
      assistant.thinking = assistant.thinking
        ? `${assistant.thinking}\n\n${nextThought}`.trim()
        : nextThought;
      assistant.status = 'in_progress';
      assistant.thinking_expanded = true;
      return nextTimeline;
    }
    case 'action': {
      assistant.tool_uses = [
        ...(assistant.tool_uses || []),
        {
          id: `${assistant.id}-tool-${(assistant.tool_uses || []).length + 1}`,
          tool_name: eventPayload.tool_name || '工具',
          input: eventPayload.tool_input || {},
          output: null,
          output_summary: '',
          status: 'pending',
          created_at: new Date().toISOString(),
        },
      ];
      assistant.status = 'in_progress';
      return nextTimeline;
    }
    case 'observation': {
      const output = normalizeToolOutput(eventPayload.result, eventPayload);
      const outputSummary = summarizeToolOutput(output || eventPayload.result);
      const outputStatus = inferToolStatus(output, eventPayload);
      const toolUses = [...(assistant.tool_uses || [])];
      const targetIndex = [...toolUses].reverse().findIndex((item) => item.status === 'pending');
      if (targetIndex !== -1) {
        const actualIndex = toolUses.length - 1 - targetIndex;
        toolUses[actualIndex] = {
          ...toolUses[actualIndex],
          output,
          output_summary: outputSummary,
          status: outputStatus,
        };
      }
      assistant.tool_uses = toolUses;
      assistant.status = 'in_progress';
      return nextTimeline;
    }
    case 'final_answer': {
      assistant.content = eventPayload.content || '';
      assistant.quality_status = eventPayload.quality_status;
      assistant.confidence = eventPayload.confidence;
      assistant.evidence = eventPayload.evidence || [];
      assistant.fallback_used = eventPayload.fallback_used || false;
      assistant.status = 'completed';
      return nextTimeline;
    }
    case 'assistant_turn_completed': {
      assistant.status = 'completed';
      assistant.thinking_expanded = false;
      return nextTimeline;
    }
    default:
      return nextTimeline;
  }
};
