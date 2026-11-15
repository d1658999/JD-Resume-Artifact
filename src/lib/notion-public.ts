const NOTION_ALLOWED_HOSTS = new Set([
  "notion.site",
  "www.notion.site",
  "notion.so",
  "www.notion.so",
]);

const NOTION_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_CHUNKS = 5;
const CHUNK_LIMIT = 100;
const MAX_WALK_DEPTH = 25;

const HEX_32_AT_END_PATTERN = /(?:^|-)([0-9a-f]{32})$/i;
const DASHED_UUID_PATTERN =
  /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const PLAIN_UUID_PATTERN = /^([0-9a-f]{32})$/i;

export class NotionPublicError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "NotionPublicError";
    this.status = status;
  }
}

export interface PublicNotionContent {
  pageId: string;
  title: string;
  text: string;
}

interface NotionBlockValue {
  id?: unknown;
  type?: unknown;
  alive?: unknown;
  properties?: Record<string, unknown>;
  content?: unknown;
  format?: Record<string, unknown>;
}

export function isAllowedNotionHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, "");

  return (
    NOTION_ALLOWED_HOSTS.has(normalized) || normalized.endsWith(".notion.site")
  );
}

export function normalizeNotionUuid(rawId: string): string | null {
  const dashedMatch = DASHED_UUID_PATTERN.exec(rawId);
  const compact =
    dashedMatch !== null
      ? dashedMatch[1].replace(/-/g, "").toLowerCase()
      : rawId.trim().toLowerCase();

  if (!PLAIN_UUID_PATTERN.test(compact)) {
    return null;
  }

  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20, 32),
  ].join("-");
}

export function extractNotionPageId(url: URL): string | null {
  const modalPageParam = url.searchParams.get("p");
  if (modalPageParam !== null) {
    const normalizedParam = extractUuidFromToken(modalPageParam);
    if (normalizedParam !== null) {
      return normalizedParam;
    }
  }

  const segments = url.pathname.split("/").filter((segment) => segment !== "");

  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const normalizedSegment = extractUuidFromToken(segments[index]);
    if (normalizedSegment !== null) {
      return normalizedSegment;
    }
  }

  return null;
}

function extractUuidFromToken(token: string): string | null {
  const decoded = safeDecode(token).trim();

  const dashedMatch = DASHED_UUID_PATTERN.exec(decoded);
  if (dashedMatch !== null) {
    return normalizeNotionUuid(dashedMatch[1]);
  }

  const endHexMatch = HEX_32_AT_END_PATTERN.exec(decoded);
  if (endHexMatch !== null) {
    return normalizeNotionUuid(endHexMatch[1]);
  }

  return null;
}

export async function fetchPublicNotionContent(
  pageUrl: URL,
  options?: { timeoutMs?: number },
): Promise<PublicNotionContent | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pageId = await resolvePageId(pageUrl, timeoutMs);

  if (pageId === null) {
    return null;
  }

  const blockMap = await loadPageBlocks(pageUrl.origin, pageId, timeoutMs);

  if (blockMap === null) {
    return null;
  }

  return extractStructuredPageContent(blockMap, pageId);
}

async function resolvePageId(
  pageUrl: URL,
  timeoutMs: number,
): Promise<string | null> {
  const directId = extractNotionPageId(pageUrl);
  if (directId !== null) {
    return directId;
  }

  const segments = pageUrl.pathname
    .split("/")
    .filter((segment) => segment !== "");
  const slug = segments.length > 0 ? safeDecode(segments[segments.length - 1]) : "";

  const data = await postNotionApi(
    `${pageUrl.origin}/api/v3/getPublicPageData`,
    {
      type: "block-space",
      name: "page",
      requestedOnPublicDomain: true,
      ...(slug !== "" ? { requestedId: slug } : {}),
    },
    timeoutMs,
  );

  if (!isRecord(data) || typeof data.pageId !== "string") {
    return null;
  }

  return normalizeNotionUuid(data.pageId);
}

async function loadPageBlocks(
  origin: string,
  pageId: string,
  timeoutMs: number,
): Promise<Record<string, unknown> | null> {
  const mergedBlocks: Record<string, unknown> = {};
  let cursor: Record<string, unknown> = { stack: [] };

  for (let chunkNumber = 0; chunkNumber < MAX_CHUNKS; chunkNumber += 1) {
    const payload = await postNotionApi(
      `${origin}/api/v3/loadCachedPageChunk`,
      {
        pageId,
        limit: CHUNK_LIMIT,
        cursor,
        chunkNumber,
        verticalColumns: false,
      },
      timeoutMs,
    );

    if (!isRecord(payload) || !isRecord(payload.recordMap)) {
      return chunkNumber === 0 ? null : mergedBlocks;
    }

    const chunkBlocks = payload.recordMap.block;
    if (isRecord(chunkBlocks)) {
      Object.assign(mergedBlocks, chunkBlocks);
    }

    const nextCursor = payload.cursor;
    if (
      !isRecord(nextCursor) ||
      !Array.isArray(nextCursor.stack) ||
      nextCursor.stack.length === 0
    ) {
      break;
    }

    cursor = nextCursor;
  }

  return Object.keys(mergedBlocks).length > 0 ? mergedBlocks : null;
}

async function postNotionApi(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": NOTION_USER_AGENT,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new NotionPublicError(
        504,
        `The Notion page request timed out after ${timeoutMs / 1000} seconds.`,
      );
    }

    throw new NotionPublicError(502, "The Notion page could not be downloaded.");
  }

  if (response.status === 401 || response.status === 403 || response.status === 404) {
    await discardBody(response);
    throw new NotionPublicError(
      502,
      "The Notion page could not be downloaded. Make sure the page is shared publicly.",
    );
  }

  if (!response.ok) {
    await discardBody(response);
    return null;
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export function extractStructuredPageContent(
  blockMap: Record<string, unknown>,
  pageId: string,
): PublicNotionContent {
  const lines: string[] = [];
  const visited = new Set<string>();
  const rootBlock = unwrapBlockValue(blockMap[pageId]);
  const title =
    rootBlock !== null ? extractRichText(rootBlock.properties?.title).trim() : "";

  function walk(blockId: string, depth: number, tableColumnOrder?: string[]): void {
    if (visited.has(blockId) || depth > MAX_WALK_DEPTH) {
      return;
    }
    visited.add(blockId);

    const block = unwrapBlockValue(blockMap[blockId]);
    if (block === null || block.alive === false) {
      return;
    }

    const blockType = typeof block.type === "string" ? block.type : "";

    // Sub-pages should contribute their title as a reference without pulling
    // unrelated child documents into the current page extraction.
    if (blockType === "page" && blockId !== pageId) {
      const subpageTitle = extractRichText(block.properties?.title).trim();
      if (subpageTitle !== "") {
        lines.push(subpageTitle);
      }
      return;
    }

    if (blockType === "table_row") {
      const rowText = extractTableRowText(block.properties, tableColumnOrder);
      if (rowText !== "") {
        lines.push(rowText);
      }
    } else {
      const blockText = extractRichText(block.properties?.title).trim();
      if (blockText !== "") {
        lines.push(formatBlockLine(blockType, blockText, block.properties));
      }

      const captionText = extractRichText(block.properties?.caption).trim();
      if (captionText !== "") {
        lines.push(captionText);
      }
    }

    const nextColumnOrder =
      blockType === "table" &&
      isRecord(block.format) &&
      Array.isArray(block.format.table_block_column_order)
        ? block.format.table_block_column_order.filter(
            (item): item is string => typeof item === "string",
          )
        : tableColumnOrder;

    if (Array.isArray(block.content)) {
      for (const childId of block.content) {
        if (typeof childId === "string") {
          walk(childId, depth + 1, nextColumnOrder);
        }
      }
    }
  }

  walk(pageId, 0);

  return {
    pageId,
    title,
    text: lines.join("\n"),
  };
}

function unwrapBlockValue(entry: unknown): NotionBlockValue | null {
  if (!isRecord(entry)) {
    return null;
  }

  const level1 = entry.value;
  if (!isRecord(level1)) {
    return null;
  }

  if (typeof level1.type === "string") {
    return level1 as NotionBlockValue;
  }

  const level2 = level1.value;
  if (isRecord(level2) && typeof level2.type === "string") {
    return level2 as NotionBlockValue;
  }

  return null;
}

function extractRichText(value: unknown): string {
  if (!Array.isArray(value)) {
    return "";
  }

  const parts: string[] = [];

  for (const segment of value) {
    if (Array.isArray(segment) && typeof segment[0] === "string") {
      parts.push(segment[0]);
    }
  }

  return parts.join("");
}

function extractTableRowText(
  properties: Record<string, unknown> | undefined,
  columnOrder?: string[],
): string {
  if (!isRecord(properties)) {
    return "";
  }

  const keys =
    columnOrder && columnOrder.length > 0
      ? columnOrder
      : Object.keys(properties);

  const cells = keys
    .map((key) => extractRichText(properties[key]).trim())
    .filter((cell) => cell !== "");

  return cells.join(" | ");
}

function formatBlockLine(
  blockType: string,
  text: string,
  properties?: Record<string, unknown>,
): string {
  if (blockType === "bulleted_list") {
    return `- ${text}`;
  }

  if (blockType === "numbered_list") {
    return `1. ${text}`;
  }

  if (blockType === "to_do") {
    const checked = extractRichText(properties?.checked).trim().toLowerCase() === "yes";
    return `${checked ? "[x]" : "[ ]"} ${text}`;
  }

  return text;
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore stream cleanup failures.
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeoutError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.name === "TimeoutError" || error.name === "AbortError";
}
