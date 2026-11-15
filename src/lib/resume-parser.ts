import { put } from "@vercel/blob";
import { load, type CheerioAPI } from "cheerio";
import mammoth from "mammoth";
import { extractText } from "unpdf";

import {
  NotionPublicError,
  fetchPublicNotionContent,
  isAllowedNotionHost,
} from "@/lib/notion-public";

export class ResumeParserError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResumeParserError";
    this.status = status;
  }
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MIN_EXTRACTED_TEXT_LENGTH = 40;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_FILE_NAME_LENGTH = 120;
const MAX_PATH_SEGMENT_LENGTH = 100;
const MAX_NOTION_SLUG_LENGTH = 60;

const BLOB_TOKEN_ENV_VAR = "BLOB_READ_WRITE_TOKEN";
const BLOB_RESUME_PREFIX = "resumes";
const TEXT_CONTENT_TYPE = "text/plain; charset=utf-8";
const PDF_EXTENSION = ".pdf";
const DOCX_EXTENSION = ".docx";
const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ACCEPT_HTML = "text/html,application/xhtml+xml";
const ACCEPT_TEXT = "text/plain";

const GOOGLE_DOCS_HOST = "docs.google.com";
const GOOGLE_DOCS_EXPORT_BASE_URL = "https://docs.google.com/document/d";
const GOOGLE_DOCS_DOCUMENT_PATH =
  /^\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/;

const REMOVED_ELEMENTS =
  "script, style, nav, footer, header, noscript, svg, iframe, form";
const PRIMARY_CONTENT_SELECTOR = "main, [role='main'], article";
const BLOCK_BOUNDARY_SELECTOR = [
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "main",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
].join(", ");

interface ParsedPublicDocument {
  text: string;
  fileName: string;
  sourceUrl: string;
}

export async function parseAndStorePdfOrDocx(file: File): Promise<{
  extractedText: string;
  blobUrl: string;
  fileName: string;
  sourceType: "pdf" | "docx";
  sourceUrl: null;
}> {
  if (file.size === 0) {
    throw new ResumeParserError(400, "The uploaded résumé file is empty.");
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ResumeParserError(
      413,
      "The uploaded résumé file exceeds the 10 MB limit.",
    );
  }

  const sourceType = detectDocumentType(file.name, file.type);
  const fileName = sanitizeDisplayFileName(file.name, sourceType);
  const buffer = await readFileBuffer(file);
  // PDF.js may detach the buffer it receives, so keep an independent copy of
  // the original bytes for the Blob upload.
  const originalBytes = Buffer.from(new Uint8Array(buffer));
  const rawText =
    sourceType === "pdf"
      ? await extractPdfText(buffer)
      : await extractDocxText(buffer);
  const extractedText = normalizeMultilineText(rawText);

  if (extractedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new ResumeParserError(
      422,
      "No readable text could be extracted from the résumé. Upload a text-based PDF or DOCX file.",
    );
  }

  const pathSegment = toSafePathSegment(
    fileName,
    sourceType === "pdf" ? PDF_EXTENSION : DOCX_EXTENSION,
  );
  const blobUrl = await uploadBlob(
    `${BLOB_RESUME_PREFIX}/${Date.now()}-${pathSegment}`,
    originalBytes,
    sourceType === "pdf" ? PDF_MIME_TYPE : DOCX_MIME_TYPE,
  );

  return { extractedText, blobUrl, fileName, sourceType, sourceUrl: null };
}

export async function parseAndStorePublicLink(
  url: string,
  sourceType: "google_docs" | "notion",
): Promise<{
  extractedText: string;
  blobUrl: string;
  fileName: string;
  sourceType: "google_docs" | "notion";
  sourceUrl: string;
}> {
  const parsedDocument =
    sourceType === "google_docs"
      ? await downloadGoogleDocsDocument(url)
      : await downloadNotionDocument(url);
  const extractedText = normalizeMultilineText(parsedDocument.text);

  if (extractedText.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new ResumeParserError(
      422,
      "No readable text could be extracted from the shared document. Make sure link sharing is enabled.",
    );
  }

  const pathSegment = toSafePathSegment(parsedDocument.fileName, ".txt");
  const blobUrl = await uploadBlob(
    `${BLOB_RESUME_PREFIX}/${Date.now()}-${pathSegment}`,
    extractedText,
    TEXT_CONTENT_TYPE,
  );

  return {
    extractedText,
    blobUrl,
    fileName: parsedDocument.fileName,
    sourceType,
    sourceUrl: parsedDocument.sourceUrl,
  };
}

function detectDocumentType(
  fileName: string,
  mimeType: string,
): "pdf" | "docx" {
  const normalizedName = fileName.trim().toLowerCase();
  const normalizedMimeType = mimeType.trim().toLowerCase();
  const matchesPdf =
    normalizedName.endsWith(PDF_EXTENSION) ||
    normalizedMimeType === PDF_MIME_TYPE;
  const matchesDocx =
    normalizedName.endsWith(DOCX_EXTENSION) ||
    normalizedMimeType === DOCX_MIME_TYPE;

  if (matchesPdf && !matchesDocx) {
    return "pdf";
  }

  if (matchesDocx && !matchesPdf) {
    return "docx";
  }

  throw new ResumeParserError(
    400,
    "Only PDF and DOCX résumés are supported.",
  );
}

async function readFileBuffer(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer();
  } catch {
    throw new ResumeParserError(
      400,
      "The uploaded résumé file could not be read.",
    );
  }
}

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await extractText(new Uint8Array(buffer), {
      mergePages: true,
    });

    return result.text;
  } catch {
    throw new ResumeParserError(
      422,
      "The PDF file could not be parsed. It may be corrupted or password protected.",
    );
  }
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });

    return result.value;
  } catch {
    throw new ResumeParserError(
      422,
      "The DOCX file could not be parsed. It may be corrupted or password protected.",
    );
  }
}

function sanitizeDisplayFileName(
  rawName: string,
  sourceType: "pdf" | "docx",
): string {
  const fallbackExtension =
    sourceType === "pdf" ? PDF_EXTENSION : DOCX_EXTENSION;
  const baseName = rawName.split(/[\\/]/).pop() ?? "";
  const cleaned = baseName
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[<>:"|?*]/g, "-")
    .trim()
    .replace(/^\.+/, "")
    .slice(0, MAX_FILE_NAME_LENGTH)
    .trim();

  if (cleaned === "") {
    return `resume${fallbackExtension}`;
  }

  return cleaned.toLowerCase().endsWith(fallbackExtension)
    ? cleaned
    : `${cleaned}${fallbackExtension}`;
}

function toSafePathSegment(
  fileName: string,
  fallbackExtension: string,
): string {
  const extensionMatch = /(\.[A-Za-z0-9]{1,10})$/.exec(fileName);
  const extension = (extensionMatch?.[1] ?? fallbackExtension).toLowerCase();
  const stemSource = extensionMatch
    ? fileName.slice(0, -extensionMatch[1].length)
    : fileName;
  const stem = stemSource
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+/, "")
    .slice(0, MAX_PATH_SEGMENT_LENGTH)
    .replace(/[-.]+$/, "");

  return `${stem === "" ? "resume" : stem}${extension}`;
}

async function uploadBlob(
  pathname: string,
  body: string | Buffer,
  contentType: string,
): Promise<string> {
  const token = process.env[BLOB_TOKEN_ENV_VAR];

  if (token === undefined || token.trim() === "") {
    throw new ResumeParserError(500, "Blob storage is not configured.");
  }

  try {
    const result = await put(pathname, body, {
      access: "public",
      token,
      addRandomSuffix: true,
      contentType,
    });

    return result.url;
  } catch {
    throw new ResumeParserError(502, "The résumé could not be stored.");
  }
}

async function downloadGoogleDocsDocument(
  rawUrl: string,
): Promise<ParsedPublicDocument> {
  const pageUrl = parseHttpsLink(rawUrl);

  if (normalizeHostname(pageUrl.hostname) !== GOOGLE_DOCS_HOST) {
    throw new ResumeParserError(
      400,
      "Only Google Docs links from docs.google.com are supported.",
    );
  }

  const documentId = extractGoogleDocsDocumentId(pageUrl);
  const fileName = `google-docs-${documentId}.txt`;
  const exportUrl = `${GOOGLE_DOCS_EXPORT_BASE_URL}/${encodeURIComponent(documentId)}/export?format=txt`;

  const exportResponse = await requestDocument(exportUrl, ACCEPT_TEXT);

  if (
    exportResponse.ok &&
    isAllowedResponseHost(exportResponse, isGoogleDocsHost)
  ) {
    const exportBody = await readResponseText(
      exportResponse,
      MAX_DOCUMENT_BYTES,
    );

    if (!looksLikeHtmlDocument(exportBody)) {
      const exportText = normalizeMultilineText(exportBody);

      if (exportText.length >= MIN_EXTRACTED_TEXT_LENGTH) {
        return { text: exportText, fileName, sourceUrl: pageUrl.href };
      }
    }
  } else {
    await discardResponseBody(exportResponse);
  }

  const pageResponse = await requestDocument(pageUrl.href, ACCEPT_HTML);

  if (!pageResponse.ok || !isAllowedResponseHost(pageResponse, isGoogleDocsHost)) {
    await discardResponseBody(pageResponse);
    throw new ResumeParserError(
      502,
      "The Google Docs document could not be downloaded. Make sure the document is shared publicly.",
    );
  }

  const pageHtml = await readResponseText(pageResponse, MAX_DOCUMENT_BYTES);

  return {
    text: extractHtmlText(pageHtml),
    fileName,
    sourceUrl: pageUrl.href,
  };
}

async function downloadNotionDocument(
  rawUrl: string,
): Promise<ParsedPublicDocument> {
  const pageUrl = parseHttpsLink(rawUrl);
  const hostname = normalizeHostname(pageUrl.hostname);

  if (!isAllowedNotionHost(hostname)) {
    throw new ResumeParserError(
      400,
      "Only notion.site and notion.so links are supported.",
    );
  }

  const fileName = `notion-${extractNotionSlug(pageUrl)}.txt`;

  try {
    const notionContent = await fetchPublicNotionContent(pageUrl, {
      timeoutMs: FETCH_TIMEOUT_MS,
    });

    if (
      notionContent !== null &&
      normalizeMultilineText(notionContent.text).length >=
        MIN_EXTRACTED_TEXT_LENGTH
    ) {
      return {
        text: notionContent.text,
        fileName,
        sourceUrl: pageUrl.href,
      };
    }
  } catch (error) {
    if (error instanceof NotionPublicError) {
      throw new ResumeParserError(error.status, error.message);
    }
    throw error;
  }

  const response = await requestDocument(pageUrl.href, ACCEPT_HTML);

  if (!response.ok || !isAllowedResponseHost(response, isAllowedNotionHost)) {
    await discardResponseBody(response);
    throw new ResumeParserError(
      502,
      "The Notion page could not be downloaded. Make sure the page is shared publicly.",
    );
  }

  const html = await readResponseText(response, MAX_DOCUMENT_BYTES);

  return {
    text: extractHtmlText(html),
    fileName,
    sourceUrl: pageUrl.href,
  };
}

function parseHttpsLink(rawUrl: string): URL {
  const trimmed = rawUrl.trim();

  if (trimmed === "") {
    throw new ResumeParserError(400, "A document link is required.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new ResumeParserError(
      400,
      "The document link is not a valid URL.",
    );
  }

  if (parsedUrl.protocol !== "https:") {
    throw new ResumeParserError(
      400,
      "Only https document links are supported.",
    );
  }

  if (parsedUrl.username !== "" || parsedUrl.password !== "") {
    throw new ResumeParserError(
      400,
      "Links with embedded credentials are not supported.",
    );
  }

  if (normalizeHostname(parsedUrl.hostname) === "") {
    throw new ResumeParserError(
      400,
      "The document link is missing a hostname.",
    );
  }

  return parsedUrl;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[([^\]]*)\]$/, "$1")
    .replace(/\.+$/, "");
}

function extractGoogleDocsDocumentId(url: URL): string {
  const match = GOOGLE_DOCS_DOCUMENT_PATH.exec(url.pathname);

  if (match === null || match[1] === undefined || match[1] === "") {
    throw new ResumeParserError(
      400,
      "The link is not a Google Docs document URL.",
    );
  }

  return match[1];
}

function isGoogleDocsHost(hostname: string): boolean {
  return hostname === GOOGLE_DOCS_HOST;
}

function extractNotionSlug(url: URL): string {
  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  const lastSegment = segments.length > 0 ? segments[segments.length - 1] : "";
  const slug = sanitizeSlug(safeDecodeURIComponent(lastSegment));

  if (slug !== "") {
    return slug;
  }

  const hostSlug = sanitizeSlug(
    normalizeHostname(url.hostname).replace(/^www\./, ""),
  );

  return hostSlug === "" ? "page" : hostSlug;
}

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NOTION_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function requestDocument(
  url: string,
  accept: string,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        accept,
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeoutFailure(error)) {
      throw new ResumeParserError(
        504,
        `The document request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`,
      );
    }

    throw new ResumeParserError(502, "The document could not be downloaded.");
  }
}

function isAllowedResponseHost(
  response: Response,
  isAllowed: (hostname: string) => boolean,
): boolean {
  if (response.url === "") {
    return true;
  }

  try {
    return isAllowed(normalizeHostname(new URL(response.url).hostname));
  } catch {
    return false;
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore cleanup failures for an already-closed response stream.
  }
}

async function readResponseText(
  response: Response,
  byteLimit: number,
): Promise<string> {
  const body = response.body;

  if (body === null) {
    return "";
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < byteLimit) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value === undefined) {
        continue;
      }

      const remaining = byteLimit - totalBytes;
      const chunk =
        value.byteLength > remaining ? value.subarray(0, remaining) : value;

      chunks.push(chunk);
      totalBytes += chunk.byteLength;
    }
  } catch (error) {
    if (isTimeoutFailure(error)) {
      throw new ResumeParserError(
        504,
        `The document request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`,
      );
    }

    throw new ResumeParserError(502, "The document could not be read.");
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Ignore cleanup failures for an already-closed response stream.
    }
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder("utf-8").decode(merged);
}

function looksLikeHtmlDocument(value: string): boolean {
  const trimmed = value.trimStart().toLowerCase();

  return trimmed.startsWith("<") || trimmed.includes("<html");
}

function extractHtmlText(html: string): string {
  const $ = parseHtml(html);

  $(REMOVED_ELEMENTS).remove();
  insertBlockBoundaries($);

  const primaryText = longestNormalizedText($, PRIMARY_CONTENT_SELECTOR);

  if (primaryText !== "") {
    return primaryText;
  }

  return normalizeMultilineText($("body").text());
}

function parseHtml(html: string): CheerioAPI {
  try {
    return load(html);
  } catch {
    throw new ResumeParserError(422, "The shared document could not be parsed.");
  }
}

function insertBlockBoundaries($: CheerioAPI): void {
  $("br").replaceWith("\n");

  $(BLOCK_BOUNDARY_SELECTOR).each((_, element) => {
    $(element).append("\n");
  });
}

function longestNormalizedText($: CheerioAPI, selector: string): string {
  let longest = "";

  $(selector).each((_, element) => {
    const text = normalizeMultilineText($(element).text());

    if (text.length > longest.length) {
      longest = text;
    }
  });

  return longest;
}

function normalizeMultilineText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTimeoutFailure(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.name === "TimeoutError" || error.name === "AbortError";
}
