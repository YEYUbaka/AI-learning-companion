import { linkifyPlainUrls } from './links';

const normalizeInlineHtml = (content = '') =>
  content
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '<br />')
    .replace(/&nbsp;/gi, ' ');

const splitTableCells = (line = '') =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());

const getTableCellCount = (line = '') => splitTableCells(line).length;

const isTableRowLine = (line = '') => {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
    return false;
  }
  return getTableCellCount(trimmed) >= 2;
};

const isTableSeparatorLine = (line = '') => {
  if (!isTableRowLine(line)) {
    return false;
  }
  return splitTableCells(line).every((cell) => /^:?-{3,}:?$/.test(cell));
};

const createFallbackTableHeader = (cellCount) =>
  `| ${Array.from({ length: cellCount }, (_, index) => `列${index + 1}`).join(' | ')} |`;

const createFallbackTableSeparator = (cellCount) =>
  `| ${Array.from({ length: cellCount }, () => '---').join(' | ')} |`;

const repairMarkdownTables = (content = '') => {
  const lines = content.split('\n');
  const repaired = [];
  let rememberedHeader = null;
  let rememberedSeparator = null;
  let insideTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || '';

    if (isTableRowLine(line) && isTableSeparatorLine(nextLine)) {
      rememberedHeader = line;
      rememberedSeparator = nextLine;
      insideTable = true;
      repaired.push(line, nextLine);
      index += 1;
      continue;
    }

    if (isTableRowLine(line)) {
      const cellCount = getTableCellCount(line);
      if (!insideTable) {
        const header =
          rememberedHeader && getTableCellCount(rememberedHeader) === cellCount
            ? rememberedHeader
            : createFallbackTableHeader(cellCount);
        const separator =
          rememberedSeparator && getTableCellCount(rememberedSeparator) === cellCount
            ? rememberedSeparator
            : createFallbackTableSeparator(cellCount);
        repaired.push(header, separator);
      }
      insideTable = true;
      repaired.push(line);
      continue;
    }

    if (line.trim() !== '') {
      insideTable = false;
    } else if (insideTable) {
      insideTable = false;
    }

    repaired.push(line);
  }

  return repaired.join('\n');
};

export const normalizeMarkdownContent = (content = '') =>
  repairMarkdownTables(linkifyPlainUrls(normalizeInlineHtml(content)));
