export interface JsonPosition {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

/**
 * Resolves a ZodIssue path (e.g. ["address", "street"] or ["items", 0])
 * to line/column positions within a JSON string.
 *
 * Returns null if the path cannot be resolved.
 */
export function resolveJsonPath(
  text: string,
  path: PropertyKey[],
): JsonPosition | null {
  if (path.length === 0) {
    return makePosition(text, 0, text.length);
  }

  let offset = 0;

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];

    if (typeof segment === "number") {
      offset = findArrayIndex(text, offset, segment);
    } else {
      offset = findObjectKey(text, offset, String(segment));
    }

    if (offset === -1) {
      return null;
    }
  }

  const valueEnd = findValueEnd(text, offset);
  return makePosition(text, offset, valueEnd);
}

function skipWhitespace(text: string, pos: number): number {
  while (pos < text.length && /\s/.test(text[pos]!)) {
    pos++;
  }
  return pos;
}

function findObjectKey(text: string, start: number, key: string): number {
  let pos = skipWhitespace(text, start);

  if (text[pos] !== "{") return -1;
  pos++;

  let depth = 0;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "}") {
      if (depth === 0) return -1;
      depth--;
      pos++;
      continue;
    }

    if (depth > 0) {
      pos = skipValue(text, pos);
      pos = skipWhitespace(text, pos);
      if (text[pos] === "," || text[pos] === ":") pos++;
      continue;
    }

    if (text[pos] !== '"') return -1;

    // const keyStart = pos;
    const parsedKey = parseStringLiteral(text, pos);
    if (parsedKey === null) return -1;
    pos = parsedKey.end;

    pos = skipWhitespace(text, pos);
    if (text[pos] !== ":") return -1;
    pos++;
    pos = skipWhitespace(text, pos);

    if (parsedKey.value === key) {
      return pos;
    }

    pos = skipValue(text, pos);
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
  }

  return -1;
}

function findArrayIndex(text: string, start: number, index: number): number {
  let pos = skipWhitespace(text, start);

  if (text[pos] !== "[") return -1;
  pos++;

  let currentIndex = 0;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "]") return -1;

    if (currentIndex === index) {
      return pos;
    }

    pos = skipValue(text, pos);
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
    currentIndex++;
  }

  return -1;
}

function skipValue(text: string, pos: number): number {
  pos = skipWhitespace(text, pos);
  const ch = text[pos];

  if (ch === '"') {
    const result = parseStringLiteral(text, pos);
    return result ? result.end : pos + 1;
  }

  if (ch === "{") {
    return skipBraced(text, pos, "{", "}");
  }

  if (ch === "[") {
    return skipBraced(text, pos, "[", "]");
  }

  while (pos < text.length && !/[,\]}\s]/.test(text[pos]!)) {
    pos++;
  }
  return pos;
}

function skipBraced(
  text: string,
  pos: number,
  open: string,
  close: string,
): number {
  let depth = 0;
  let inString = false;

  while (pos < text.length) {
    const ch = text[pos];

    if (inString) {
      if (ch === "\\") {
        pos++;
      } else if (ch === '"') {
        inString = false;
      }
    } else {
      if (ch === '"') {
        inString = true;
      } else if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          return pos + 1;
        }
      }
    }
    pos++;
  }
  return pos;
}

function parseStringLiteral(
  text: string,
  pos: number,
): { value: string; end: number } | null {
  if (text[pos] !== '"') return null;
  pos++;

  let value = "";
  while (pos < text.length) {
    const ch = text[pos];
    if (ch === "\\") {
      pos++;
      value += text[pos];
      pos++;
      continue;
    }
    if (ch === '"') {
      return { value, end: pos + 1 };
    }
    value += ch;
    pos++;
  }
  return null;
}

function findValueEnd(text: string, pos: number): number {
  return skipValue(text, pos);
}

export function positionToOffset(
  text: string,
  lineNumber: number,
  column: number,
): number {
  let line = 1;
  let col = 1;

  for (let i = 0; i < text.length; i++) {
    if (line === lineNumber && col === column) {
      return i;
    }
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }

  if (line === lineNumber && col === column) {
    return text.length;
  }

  return text.length;
}

export interface ValueContext {
  path: string[];
  keyRange: JsonPosition;
  /** Offset range of the complete value (including quotes for strings) */
  valueStart: number;
  valueEnd: number;
  /** Whether cursor is inside a string literal (between quotes) */
  insideString: boolean;
  /** Offset of first char after opening quote (if inside string) */
  innerStart: number;
  /** Offset of closing quote (if inside string) */
  innerEnd: number;
}

export function resolvePathAtOffset(
  text: string,
  offset: number,
): { path: string[]; keyRange: JsonPosition } | null {
  return resolvePathInValue(text, 0, offset, []);
}

export function getValueContext(
  text: string,
  offset: number,
): ValueContext | null {
  return getValueContextInValue(text, 0, offset, []);
}

function getValueContextInValue(
  text: string,
  pos: number,
  target: number,
  path: string[],
): ValueContext | null {
  pos = skipWhitespace(text, pos);
  const ch = text[pos];

  if (ch === "{") {
    return getValueContextInObject(text, pos, target, path);
  }

  if (ch === "[") {
    return getValueContextInArray(text, pos, target, path);
  }

  return null;
}

function getValueContextInObject(
  text: string,
  pos: number,
  target: number,
  path: string[],
): ValueContext | null {
  if (text[pos] !== "{") return null;
  pos++;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "}") return null;

    if (text[pos] !== '"') return null;

    const keyStart = pos;
    const parsedKey = parseStringLiteral(text, pos);
    if (parsedKey === null) return null;
    const keyEnd = parsedKey.end;
    pos = keyEnd;

    pos = skipWhitespace(text, pos);
    if (text[pos] !== ":") return null;
    pos++;
    pos = skipWhitespace(text, pos);

    const valueStart = pos;
    const valueEnd = skipValue(text, pos);

    if (target >= valueStart && target <= valueEnd) {
      const childPath = [...path, parsedKey.value];
      const nested = getValueContextInValue(
        text,
        valueStart,
        target,
        childPath,
      );
      if (nested) return nested;

      const insideString = text[valueStart] === '"';
      return {
        path: childPath,
        keyRange: makePosition(text, keyStart, keyEnd),
        valueStart,
        valueEnd,
        insideString,
        innerStart: insideString ? valueStart + 1 : valueStart,
        innerEnd: insideString ? valueEnd - 1 : valueEnd,
      };
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
  }

  return null;
}

function getValueContextInArray(
  text: string,
  pos: number,
  target: number,
  path: string[],
): ValueContext | null {
  if (text[pos] !== "[") return null;
  pos++;

  let index = 0;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "]") return null;

    const valueStart = pos;
    const valueEnd = skipValue(text, pos);

    if (target >= valueStart && target <= valueEnd) {
      const childPath = [...path, String(index)];
      const nested = getValueContextInValue(
        text,
        valueStart,
        target,
        childPath,
      );
      if (nested) return nested;

      const insideString = text[valueStart] === '"';
      return {
        path: childPath,
        keyRange: makePosition(text, valueStart, valueEnd),
        valueStart,
        valueEnd,
        insideString,
        innerStart: insideString ? valueStart + 1 : valueStart,
        innerEnd: insideString ? valueEnd - 1 : valueEnd,
      };
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
    index++;
  }

  return null;
}

function resolvePathInValue(
  text: string,
  pos: number,
  target: number,
  path: string[],
): { path: string[]; keyRange: JsonPosition } | null {
  pos = skipWhitespace(text, pos);
  const ch = text[pos];

  if (ch === "{") {
    return resolvePathInObject(text, pos, target, path);
  }

  if (ch === "[") {
    return resolvePathInArray(text, pos, target, path);
  }

  return null;
}

function resolvePathInObject(
  text: string,
  pos: number,
  target: number,
  path: string[],
): { path: string[]; keyRange: JsonPosition } | null {
  if (text[pos] !== "{") return null;
  pos++;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "}") return null;

    if (text[pos] !== '"') return null;

    const keyStart = pos;
    const parsedKey = parseStringLiteral(text, pos);
    if (parsedKey === null) return null;
    const keyEnd = parsedKey.end;
    pos = keyEnd;

    pos = skipWhitespace(text, pos);
    if (text[pos] !== ":") return null;
    pos++;
    pos = skipWhitespace(text, pos);

    const valueStart = pos;
    const valueEnd = skipValue(text, pos);

    if (target >= keyStart && target < keyEnd) {
      return {
        path: [...path, parsedKey.value],
        keyRange: makePosition(text, keyStart, keyEnd),
      };
    }

    if (target >= valueStart && target <= valueEnd) {
      const nested = resolvePathInValue(text, valueStart, target, [
        ...path,
        parsedKey.value,
      ]);
      if (nested) return nested;

      return {
        path: [...path, parsedKey.value],
        keyRange: makePosition(text, keyStart, keyEnd),
      };
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
  }

  return null;
}

function resolvePathInArray(
  text: string,
  pos: number,
  target: number,
  path: string[],
): { path: string[]; keyRange: JsonPosition } | null {
  if (text[pos] !== "[") return null;
  pos++;

  let index = 0;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "]") return null;

    const valueStart = pos;
    const valueEnd = skipValue(text, pos);

    if (target >= valueStart && target <= valueEnd) {
      const nested = resolvePathInValue(text, valueStart, target, [
        ...path,
        String(index),
      ]);
      if (nested) return nested;

      return {
        path: [...path, String(index)],
        keyRange: makePosition(text, valueStart, valueEnd),
      };
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
    index++;
  }

  return null;
}

export function makePosition(
  text: string,
  start: number,
  end: number,
): JsonPosition {
  let line = 1;
  let col = 1;

  let startLine = 1;
  let startCol = 1;
  let endLine = 1;
  let endCol = 1;

  for (let i = 0; i < end && i < text.length; i++) {
    if (i === start) {
      startLine = line;
      startCol = col;
    }

    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }

  endLine = line;
  endCol = col;

  return {
    startLineNumber: startLine,
    startColumn: startCol,
    endLineNumber: endLine,
    endColumn: endCol,
  };
}
