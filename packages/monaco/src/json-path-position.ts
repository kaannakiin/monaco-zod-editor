/** Path segment: string for object keys, number for array indices */
export type PathSegment = string | number;

/** Offset range within the source text (end is exclusive). */
export interface OffsetRange {
  start: number;
  end: number;
}

export interface ValueContext {
  path: PathSegment[];
  /** Offset range of the key (including quotes). */
  keyStart: number;
  keyEnd: number;
  /** Offset range of the complete value (including quotes for strings). */
  valueStart: number;
  valueEnd: number;
  /** Whether cursor is inside a string literal (between quotes). */
  insideString: boolean;
  /** Offset of first char after opening quote (if inside string). */
  innerStart: number;
  /** Offset of closing quote (if inside string). */
  innerEnd: number;
}

/**
 * Resolves a ZodIssue path (e.g. ["address", "street"] or ["items", 0])
 * to an offset range within a JSON string. Returns null if the path cannot
 * be resolved.
 */
export function resolveJsonPath(
  text: string,
  path: PropertyKey[],
): OffsetRange | null {
  if (path.length === 0) {
    return { start: 0, end: text.length };
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

  const valueEnd = skipValue(text, offset);
  return { start: offset, end: valueEnd };
}

function skipWhitespace(text: string, pos: number): number {
  while (pos < text.length) {
    const ch = text.charCodeAt(pos);

    if (ch !== 32 && ch !== 9 && ch !== 10 && ch !== 13) break;
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

  while (pos < text.length) {
    const c = text.charCodeAt(pos);

    if (
      c === 44 ||
      c === 93 ||
      c === 125 ||
      c === 32 ||
      c === 9 ||
      c === 10 ||
      c === 13
    )
      break;
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
      const esc = text[pos];
      switch (esc) {
        case '"':
          value += '"';
          break;
        case "\\":
          value += "\\";
          break;
        case "/":
          value += "/";
          break;
        case "b":
          value += "\b";
          break;
        case "f":
          value += "\f";
          break;
        case "n":
          value += "\n";
          break;
        case "r":
          value += "\r";
          break;
        case "t":
          value += "\t";
          break;
        case "u": {
          const hex = text.slice(pos + 1, pos + 5);
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            value += String.fromCharCode(parseInt(hex, 16));
            pos += 4;
          } else {
            value += esc;
          }
          break;
        }
        default:
          value += esc;
      }
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

export function resolvePathAtOffset(
  text: string,
  offset: number,
): { path: PathSegment[]; keyStart: number; keyEnd: number } | null {
  return resolvePathInValue(text, 0, offset, []);
}

function collectInValue(
  text: string,
  pos: number,
  rangeStart: number,
  rangeEnd: number,
  path: PathSegment[],
  results: PathSegment[][],
): void {
  pos = skipWhitespace(text, pos);
  if (pos >= text.length) return;
  const ch = text[pos];
  if (ch === "{") {
    collectInObject(text, pos, rangeStart, rangeEnd, path, results);
  } else if (ch === "[") {
    collectInArray(text, pos, rangeStart, rangeEnd, path, results);
  }
}

function collectInObject(
  text: string,
  pos: number,
  rangeStart: number,
  rangeEnd: number,
  path: PathSegment[],
  results: PathSegment[][],
): void {
  if (text[pos] !== "{") return;
  pos++;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "}" || text[pos] === undefined) break;
    if (text[pos] !== '"') break;

    const keyStart = pos;
    const parsedKey = parseStringLiteral(text, pos);
    if (parsedKey === null) break;
    pos = parsedKey.end;

    pos = skipWhitespace(text, pos);
    if (text[pos] !== ":") break;
    pos++;
    pos = skipWhitespace(text, pos);

    const valueStart = pos;
    const valueEnd = skipValue(text, pos);

    if (keyStart < rangeEnd && valueEnd > rangeStart) {
      const fieldPath = [...path, parsedKey.value];
      results.push(fieldPath);

      const vPos = skipWhitespace(text, valueStart);
      if (text[vPos] === "{" || text[vPos] === "[") {
        collectInValue(
          text,
          valueStart,
          rangeStart,
          rangeEnd,
          fieldPath,
          results,
        );
      }
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
  }
}

function collectInArray(
  text: string,
  pos: number,
  rangeStart: number,
  rangeEnd: number,
  path: PathSegment[],
  results: PathSegment[][],
): void {
  if (text[pos] !== "[") return;
  pos++;
  let index = 0;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "]" || text[pos] === undefined) break;

    const valueStart = pos;
    const valueEnd = skipValue(text, pos);

    if (valueStart < rangeEnd && valueEnd > rangeStart) {
      const itemPath = [...path, index];
      results.push(itemPath);
      const vPos = skipWhitespace(text, valueStart);
      if (text[vPos] === "{" || text[vPos] === "[") {
        collectInValue(
          text,
          valueStart,
          rangeStart,
          rangeEnd,
          itemPath,
          results,
        );
      }
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
    index++;
  }
}

/**
 * Collects all JSON field paths whose byte range overlaps
 * [rangeOffset, rangeOffset + rangeLength).
 */
export function collectPathsInRange(
  text: string,
  rangeOffset: number,
  rangeLength: number,
): PathSegment[][] {
  if (rangeLength <= 0) return [];
  const rangeEnd = rangeOffset + rangeLength;
  const results: PathSegment[][] = [];
  const pos = skipWhitespace(text, 0);
  if (pos < text.length && (text[pos] === "{" || text[pos] === "[")) {
    collectInValue(text, pos, rangeOffset, rangeEnd, [], results);
  }
  return results;
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
  path: PathSegment[],
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
  path: PathSegment[],
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
        keyStart,
        keyEnd,
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
  path: PathSegment[],
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
      const childPath = [...path, index];
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
        keyStart: valueStart,
        keyEnd: valueEnd,
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
  path: PathSegment[],
): { path: PathSegment[]; keyStart: number; keyEnd: number } | null {
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
  path: PathSegment[],
): { path: PathSegment[]; keyStart: number; keyEnd: number } | null {
  if (text[pos] !== "{") return null;
  const objectStart = pos;
  pos++;

  let lastResult: { path: PathSegment[]; keyStart: number; keyEnd: number } | null = null;

  while (pos < text.length) {
    pos = skipWhitespace(text, pos);

    if (text[pos] === "}") {
      if (target > objectStart && target < pos && lastResult) return lastResult;
      return null;
    }

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

    if (target < keyStart && lastResult) return lastResult;

    if (target >= keyStart && target < keyEnd) {
      return {
        path: [...path, parsedKey.value],
        keyStart,
        keyEnd,
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
        keyStart,
        keyEnd,
      };
    }

    lastResult = {
      path: [...path, parsedKey.value],
      keyStart,
      keyEnd,
    };

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
  path: PathSegment[],
): { path: PathSegment[]; keyStart: number; keyEnd: number } | null {
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
        index,
      ]);
      if (nested) return nested;

      return {
        path: [...path, index],
        keyStart: valueStart,
        keyEnd: valueEnd,
      };
    }

    pos = valueEnd;
    pos = skipWhitespace(text, pos);
    if (text[pos] === ",") pos++;
    index++;
  }

  return null;
}
