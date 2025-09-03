export type LocalPrediction = {
  suggestion: string;
  confidence: number; // 0..1
};

const PAREN_OPEN = ["(", "[", "{"] as const;
const PAREN_CLOSE = [")", "]", "}"] as const;

export function localPredict(prefix: string): LocalPrediction {
  const trimmed = prefix ?? "";
  if (!trimmed) return { suggestion: "", confidence: 0 };

  // 1) Close unmatched parentheses/brackets/quotes/backticks
  const closers = computeClosers(trimmed);
  if (closers) {
    return { suggestion: closers, confidence: 0.95 };
  }

  // 2) Close Markdown code fence
  const fence = closeCodeFence(trimmed);
  if (fence) {
    return { suggestion: fence, confidence: 0.9 };
  }

  // 3) Continue markdown/numbered list with same indent
  const listCont = continueList(trimmed);
  if (listCont) {
    return { suggestion: listCont, confidence: 0.72 };
  }

  return { suggestion: "", confidence: 0 };
}

function computeClosers(text: string): string {
  const stack: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const isEscaped = i > 0 && text[i - 1] === "\\";
    const openIdx = PAREN_OPEN.indexOf(ch as (typeof PAREN_OPEN)[number]);
    const closeIdx = PAREN_CLOSE.indexOf(ch as (typeof PAREN_CLOSE)[number]);

    if (openIdx >= 0) {
      stack.push(PAREN_CLOSE[openIdx]);
      continue;
    }
    if (closeIdx >= 0) {
      // pop matching if available
      const expected = PAREN_CLOSE[closeIdx];
      const top = stack[stack.length - 1];
      if (top === expected) stack.pop();
      continue;
    }

    // quotes (simple heuristic)
    if (!isEscaped && (ch === '"' || ch === "'" || ch === "`")) {
      const top = stack[stack.length - 1];
      if (top === ch) {
        stack.pop();
      } else {
        stack.push(ch);
      }
    }
  }

  if (stack.length === 0) return "";
  // generate closers in reverse order
  return stack.reverse().join("");
}

function closeCodeFence(text: string): string {
  const fenceCount = (text.match(/```/g) || []).length;
  if (fenceCount % 2 === 1) {
    return "\n```";
  }
  return "";
}

function continueList(text: string): string {
  const lastBreak = Math.max(text.lastIndexOf("\n"), -1);
  const lastLine = text.slice(lastBreak + 1);
  const m = lastLine.match(/^(\s*)([-*+]\s|\d+[\.)]\s)/);
  if (!m) return "";
  const indent = m[1] ?? "";
  const bullet = m[2] ?? "";
  const num = bullet.match(/^(\d+)/)?.[1];
  if (num) {
    const next = String(parseInt(num, 10) + 1);
    return `\n${indent}${next}${bullet.endsWith(") ") ? ") " : ". "}`;
  }
  return `\n${indent}${bullet}`;
}


