import { lookup } from "node:dns/promises";

import { load, type CheerioAPI } from "cheerio";

import { Job104Error, fetch104JobPosting, is104JobHost } from "@/lib/job104";
import {
  NotionPublicError,
  fetchPublicNotionContent,
  isAllowedNotionHost,
} from "@/lib/notion-public";

export class ScraperError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ScraperError";
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 3;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MIN_EXTRACTED_TEXT_LENGTH = 40;
const MAX_TITLE_LENGTH = 300;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const ACCEPT_HEADER = "text/html,application/xhtml+xml";

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const HTML_MIME_TYPES = new Set([
  "text/html",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
]);

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
]);

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".localdomain",
  ".internal",
  ".home.arpa",
];

// Each range is private, loopback, link-local, reserved, or otherwise not
// reachable on the public internet.
const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00000000, 0xff000000], // 0.0.0.0/8
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x64400000, 0xffc00000], // 100.64.0.0/10
  [0x7f000000, 0xff000000], // 127.0.0.0/8
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0000000, 0xffffff00], // 192.0.0.0/24
  [0xc0000200, 0xffffff00], // 192.0.2.0/24
  [0xc0586300, 0xffffff00], // 192.88.99.0/24
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0xc6120000, 0xfffe0000], // 198.18.0.0/15
  [0xc6336400, 0xffffff00], // 198.51.100.0/24
  [0xcb007100, 0xffffff00], // 203.0.113.0/24
  [0xe0000000, 0xf0000000], // 224.0.0.0/4
  [0xf0000000, 0xf0000000], // 240.0.0.0/4
];

const REMOVED_ELEMENTS =
  "script, style, nav, footer, header, noscript, svg, iframe, form";

const PRIMARY_CONTENT_SELECTOR = "main, [role='main'], article";
const FALLBACK_CONTENT_SELECTOR =
  "#content, #main, .content, .main, .post-content, .job-description, section, div";

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

interface FetchedPage {
  html: string;
  finalUrl: URL;
}

interface HostAddress {
  address: string;
  family: number;
}

export async function fetchJobDescriptionFromUrl(
  url: string,
): Promise<{ title: string; text: string; url: string }> {
  const validatedUrl = await validateTargetUrl(url);

  if (is104JobHost(validatedUrl.hostname)) {
    try {
      const job104Posting = await fetch104JobPosting(validatedUrl, {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      if (job104Posting !== null) {
        const job104Text = normalizeMultilineText(job104Posting.text);

        if (job104Text.length < MIN_EXTRACTED_TEXT_LENGTH) {
          throw new ScraperError(
            422,
            "No readable job description text could be extracted from the 104 job posting.",
          );
        }

        return {
          title: normalizeInlineText(job104Posting.title).slice(
            0,
            MAX_TITLE_LENGTH,
          ),
          text: job104Text,
          url: validatedUrl.href,
        };
      }
    } catch (error) {
      if (error instanceof Job104Error) {
        throw new ScraperError(error.status, error.message);
      }
      throw error;
    }
  }

  if (isAllowedNotionHost(validatedUrl.hostname)) {
    try {
      const notionContent = await fetchPublicNotionContent(validatedUrl, {
        timeoutMs: REQUEST_TIMEOUT_MS,
      });

      if (notionContent !== null) {
        const notionText = normalizeMultilineText(notionContent.text);

        if (notionText.length >= MIN_EXTRACTED_TEXT_LENGTH) {
          const titleCandidate =
            notionContent.title !== ""
              ? notionContent.title
              : validatedUrl.hostname;
          return {
            title: normalizeInlineText(titleCandidate).slice(
              0,
              MAX_TITLE_LENGTH,
            ),
            text: notionText,
            url: validatedUrl.href,
          };
        }
      }
    } catch (error) {
      if (error instanceof NotionPublicError) {
        throw new ScraperError(error.status, error.message);
      }
      throw error;
    }
  }

  const { html, finalUrl } = await fetchValidatedHtml(validatedUrl);
  const $ = parseHtml(html);
  const title = resolveTitle($, finalUrl.hostname);

  $(REMOVED_ELEMENTS).remove();
  insertBlockBoundaries($);

  const text = extractContentText($);

  if (text.length < MIN_EXTRACTED_TEXT_LENGTH) {
    throw new ScraperError(
      422,
      "No readable job description text could be extracted from the URL.",
    );
  }

  return { title, text, url: finalUrl.href };
}

async function fetchValidatedHtml(initialUrl: URL): Promise<FetchedPage> {
  let currentUrl = initialUrl;

  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    const response = await requestPage(currentUrl);

    if (REDIRECT_STATUS_CODES.has(response.status)) {
      const location = response.headers.get("location");
      await discardResponseBody(response);

      if (location === null || location.trim() === "") {
        throw new ScraperError(
          502,
          "The job posting page returned a redirect without a location.",
        );
      }

      if (redirectCount === MAX_REDIRECTS) {
        throw new ScraperError(
          502,
          `The job posting page exceeded ${MAX_REDIRECTS} redirects.`,
        );
      }

      const redirectTarget = resolveRedirectTarget(location, currentUrl);
      currentUrl = await validateTargetUrl(redirectTarget.href);
      continue;
    }

    if (!response.ok) {
      await discardResponseBody(response);
      throw new ScraperError(
        502,
        `The job posting page returned HTTP ${response.status}.`,
      );
    }

    const contentType = response.headers.get("content-type");

    if (contentType !== null && !isHtmlContentType(contentType)) {
      await discardResponseBody(response);
      throw new ScraperError(422, "The URL did not return an HTML page.");
    }

    const html = await readResponseBodyText(response, MAX_RESPONSE_BYTES);

    return { html, finalUrl: currentUrl };
  }

  throw new ScraperError(
    502,
    `The job posting page exceeded ${MAX_REDIRECTS} redirects.`,
  );
}

async function requestPage(url: URL): Promise<Response> {
  try {
    return await fetch(url.href, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: {
        accept: ACCEPT_HEADER,
        "user-agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (isTimeoutFailure(error)) {
      throw new ScraperError(
        504,
        `The job posting page took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to load.`,
      );
    }

    throw new ScraperError(502, "The job posting page could not be fetched.");
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore cleanup failures for an already-closed response stream.
  }
}

function resolveRedirectTarget(location: string, baseUrl: URL): URL {
  try {
    return new URL(location, baseUrl);
  } catch {
    throw new ScraperError(
      502,
      "The job posting page redirected to an invalid URL.",
    );
  }
}

async function readResponseBodyText(
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
      throw new ScraperError(
        504,
        `The job posting page took longer than ${REQUEST_TIMEOUT_MS / 1000} seconds to load.`,
      );
    }

    throw new ScraperError(502, "The job posting page could not be read.");
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

function isHtmlContentType(contentType: string): boolean {
  const [mimeTypePart] = contentType.split(";");
  const mimeType = mimeTypePart.trim().toLowerCase();

  if (mimeType === "") {
    return true;
  }

  return HTML_MIME_TYPES.has(mimeType) || mimeType.startsWith("text/");
}

async function validateTargetUrl(rawUrl: string): Promise<URL> {
  const parsedUrl = parseHttpUrl(rawUrl);
  await assertHostIsPublic(parsedUrl.hostname);

  return parsedUrl;
}

function parseHttpUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();

  if (trimmed === "") {
    throw new ScraperError(400, "A job posting URL is required.");
  }

  const parsedUrl = parseUrlValue(trimmed);

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new ScraperError(400, "Only http and https URLs are supported.");
  }

  if (parsedUrl.username !== "" || parsedUrl.password !== "") {
    throw new ScraperError(
      400,
      "URLs with embedded credentials are not supported.",
    );
  }

  if (normalizeHostname(parsedUrl.hostname) === "") {
    throw new ScraperError(400, "The URL is missing a hostname.");
  }

  return parsedUrl;
}

function parseUrlValue(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new ScraperError(400, "The job posting URL is not valid.");
  }
}

async function assertHostIsPublic(rawHostname: string): Promise<void> {
  const hostname = normalizeHostname(rawHostname);

  if (hostname === "") {
    throw new ScraperError(400, "The URL is missing a hostname.");
  }

  if (isBlockedHostname(hostname)) {
    throw new ScraperError(400, "The URL host is not allowed.");
  }

  if (isIpLiteral(hostname)) {
    if (isBlockedIpAddress(hostname)) {
      throw new ScraperError(400, "The URL host is not allowed.");
    }

    return;
  }

  const addresses = await resolveHostAddresses(hostname);

  for (const { address } of addresses) {
    if (isBlockedIpAddress(address)) {
      throw new ScraperError(
        400,
        "The URL host resolves to a non-public address.",
      );
    }
  }
}

async function resolveHostAddresses(hostname: string): Promise<HostAddress[]> {
  let addresses: HostAddress[];

  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ScraperError(400, "The URL host could not be resolved.");
  }

  if (addresses.length === 0) {
    throw new ScraperError(400, "The URL host could not be resolved.");
  }

  return addresses;
}

function normalizeHostname(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[([^\]]*)\]$/, "$1")
    .replace(/\.+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return true;
  }

  return BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function isIpLiteral(hostname: string): boolean {
  return parseIpv4(hostname) !== null || parseIpv6(hostname) !== null;
}

function isBlockedIpAddress(address: string): boolean {
  const normalized = normalizeHostname(address);

  const octets = parseIpv4(normalized);

  if (octets !== null) {
    return isBlockedIpv4Value(ipv4ValueFromOctets(octets));
  }

  const groups = parseIpv6(normalized);

  if (groups !== null) {
    return isBlockedIpv6(groups);
  }

  // Unrecognised address formats are treated as unsafe.
  return true;
}

function parseIpv4(value: string): number[] | null {
  const parts = value.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets: number[] = [];

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const octet = Number.parseInt(part, 10);

    if (octet < 0 || octet > 255) {
      return null;
    }

    octets.push(octet);
  }

  return octets;
}

function ipv4ValueFromOctets(octets: readonly number[]): number {
  return (
    ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>>
    0
  );
}

function ipv4ValueFromGroups(high: number, low: number): number {
  return ((high << 16) | low) >>> 0;
}

function isBlockedIpv4Value(value: number): boolean {
  return BLOCKED_IPV4_RANGES.some(
    ([base, mask]) => ((value & mask) >>> 0) === base,
  );
}

function parseIpv6(value: string): number[] | null {
  const withoutZone = value.split("%")[0];

  if (withoutZone === undefined || withoutZone === "") {
    return null;
  }

  const sections = withoutZone.toLowerCase().split("::");

  if (sections.length > 2) {
    return null;
  }

  if (sections.length === 1) {
    const groups = expandIpv6Groups(sections[0]);

    if (groups === null || groups.length !== 8) {
      return null;
    }

    return groups;
  }

  const head = expandIpv6Groups(sections[0]);
  const tail = expandIpv6Groups(sections[1]);

  if (head === null || tail === null) {
    return null;
  }

  const missingGroups = 8 - head.length - tail.length;

  if (missingGroups < 1) {
    return null;
  }

  return [...head, ...new Array<number>(missingGroups).fill(0), ...tail];
}

function expandIpv6Groups(section: string): number[] | null {
  if (section === "") {
    return [];
  }

  const parts = section.split(":");
  const groups: number[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];

    if (part === "") {
      return null;
    }

    if (part.includes(".")) {
      if (index !== parts.length - 1) {
        return null;
      }

      const octets = parseIpv4(part);

      if (octets === null) {
        return null;
      }

      groups.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3]);
      continue;
    }

    if (!/^[0-9a-f]{1,4}$/.test(part)) {
      return null;
    }

    groups.push(Number.parseInt(part, 16));
  }

  return groups;
}

function hasZeroPrefix(groups: readonly number[], count: number): boolean {
  for (let index = 0; index < count; index += 1) {
    if (groups[index] !== 0) {
      return false;
    }
  }

  return true;
}

function isBlockedIpv6(groups: readonly number[]): boolean {
  if (groups.length !== 8) {
    return true;
  }

  if (hasZeroPrefix(groups, 8)) {
    return true; // ::
  }

  if (hasZeroPrefix(groups, 7) && groups[7] === 1) {
    return true; // ::1
  }

  if (hasZeroPrefix(groups, 6)) {
    return isBlockedIpv4Value(ipv4ValueFromGroups(groups[6], groups[7]));
  }

  if (hasZeroPrefix(groups, 5) && groups[5] === 0xffff) {
    // ::ffff:a.b.c.d (IPv4-mapped)
    return isBlockedIpv4Value(ipv4ValueFromGroups(groups[6], groups[7]));
  }

  if (
    groups[0] === 0x0064 &&
    groups[1] === 0xff9b &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0
  ) {
    // 64:ff9b::/96 (NAT64)
    return isBlockedIpv4Value(ipv4ValueFromGroups(groups[6], groups[7]));
  }

  if (groups[0] === 0x2002) {
    // 2002::/16 (6to4)
    return isBlockedIpv4Value(ipv4ValueFromGroups(groups[1], groups[2]));
  }

  if ((groups[0] & 0xfe00) === 0xfc00) {
    return true; // fc00::/7 unique local
  }

  if ((groups[0] & 0xffc0) === 0xfe80) {
    return true; // fe80::/10 link local
  }

  if ((groups[0] & 0xffc0) === 0xfec0) {
    return true; // fec0::/10 site local
  }

  if ((groups[0] & 0xff00) === 0xff00) {
    return true; // ff00::/8 multicast
  }

  return false;
}

function parseHtml(html: string): CheerioAPI {
  try {
    return load(html);
  } catch {
    throw new ScraperError(422, "The job posting page could not be parsed.");
  }
}

function resolveTitle($: CheerioAPI, hostname: string): string {
  const candidates: Array<string | undefined> = [
    $('meta[property="og:title"]').first().attr("content"),
    $("title").first().text(),
    $("h1").first().text(),
  ];

  for (const candidate of candidates) {
    if (candidate === undefined) {
      continue;
    }

    const normalized = normalizeInlineText(candidate).slice(
      0,
      MAX_TITLE_LENGTH,
    );

    if (normalized !== "") {
      return normalized;
    }
  }

  return normalizeInlineText(hostname);
}

function insertBlockBoundaries($: CheerioAPI): void {
  $("br").replaceWith("\n");

  $(BLOCK_BOUNDARY_SELECTOR).each((_, element) => {
    $(element).append("\n");
  });
}

function extractContentText($: CheerioAPI): string {
  const primaryText = longestNormalizedText($, PRIMARY_CONTENT_SELECTOR);

  if (primaryText !== "") {
    return primaryText;
  }

  const fallbackText = longestNormalizedText($, FALLBACK_CONTENT_SELECTOR);

  if (fallbackText !== "") {
    return fallbackText;
  }

  return normalizeMultilineText($("body").text());
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

function normalizeInlineText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
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
