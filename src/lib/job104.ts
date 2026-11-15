const JOB104_ORIGIN = "https://www.104.com.tw";
const JOB104_DEFAULT_TIMEOUT_MS = 15_000;
const MAX_TITLE_LENGTH = 300;
const FALLBACK_TITLE = "104 Job Posting";

const JOB104_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const JOB104_ALLOWED_HOSTS = new Set(["104.com.tw", "www.104.com.tw"]);

const JOB104_RESERVED_JOB_SEGMENTS = new Set([
  "search",
  "category",
  "list",
  "ajax",
]);

const JOB104_JOB_CODE_PATTERN = /^[0-9a-z]+$/i;

const FIELD_TEXT_KEYS = [
  "description",
  "name",
  "text",
  "title",
  "value",
] as const;

const CLOSED_JOB_MESSAGE =
  "The 104 job posting was not found or has been closed.";
const NO_READABLE_TEXT_MESSAGE =
  "The 104 job posting did not contain any readable job description text.";
const INVALID_RESPONSE_MESSAGE =
  "The 104 job posting endpoint returned an invalid response.";

export class Job104Error extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "Job104Error";
    this.status = status;
  }
}

export interface Job104Posting {
  jobCode: string;
  title: string;
  text: string;
}

export function is104JobHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, "");

  return JOB104_ALLOWED_HOSTS.has(normalized);
}

export function extract104JobCode(url: URL): string | null {
  const segments = url.pathname
    .split("/")
    .filter((segment) => segment !== "");
  const rawJobCode = resolveJobCodeSegment(segments);

  if (rawJobCode === null) {
    return null;
  }

  const jobCode = safeDecode(rawJobCode).trim();

  if (jobCode === "" || !JOB104_JOB_CODE_PATTERN.test(jobCode)) {
    return null;
  }

  if (JOB104_RESERVED_JOB_SEGMENTS.has(jobCode.toLowerCase())) {
    return null;
  }

  return jobCode;
}

export async function fetch104JobPosting(
  url: URL,
  options?: { timeoutMs?: number },
): Promise<Job104Posting | null> {
  const jobCode = extract104JobCode(url);

  if (jobCode === null) {
    return null;
  }

  const timeoutMs = options?.timeoutMs ?? JOB104_DEFAULT_TIMEOUT_MS;
  const encodedJobCode = encodeURIComponent(jobCode);

  let response: Response;

  try {
    response = await fetch(
      `${JOB104_ORIGIN}/job/ajax/content/${encodedJobCode}`,
      {
        method: "GET",
        redirect: "manual",
        cache: "no-store",
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
          origin: JOB104_ORIGIN,
          referer: `${JOB104_ORIGIN}/job/${encodedJobCode}`,
          "user-agent": JOB104_USER_AGENT,
        },
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      throw new Job104Error(504, formatTimeoutMessage(timeoutMs));
    }

    throw new Job104Error(502, "The 104 job posting could not be downloaded.");
  }

  if (response.status >= 300 && response.status < 400) {
    await discardBody(response);
    throw new Job104Error(
      502,
      "The 104 job posting endpoint returned an unexpected redirect.",
    );
  }

  if (response.status === 404) {
    await discardBody(response);
    throw new Job104Error(404, CLOSED_JOB_MESSAGE);
  }

  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 429
  ) {
    await discardBody(response);
    throw new Job104Error(
      502,
      "The 104 job posting endpoint blocked automated access (HTTP 403). Please copy and paste the JD text instead.",
    );
  }

  if (!response.ok) {
    await discardBody(response);
    throw new Job104Error(
      502,
      `The 104 job posting endpoint returned HTTP ${response.status}.`,
    );
  }

  let payload: unknown;

  try {
    payload = (await response.json()) as unknown;
  } catch (error) {
    await discardBody(response);

    if (isTimeoutError(error)) {
      throw new Job104Error(504, formatTimeoutMessage(timeoutMs));
    }

    throw new Job104Error(502, INVALID_RESPONSE_MESSAGE);
  }

  return buildJob104Posting(jobCode, payload);
}

function resolveJobCodeSegment(segments: readonly string[]): string | null {
  if (segments.length === 2 && segments[0] === "job") {
    return segments[1];
  }

  if (
    segments.length === 4 &&
    segments[0] === "job" &&
    segments[1] === "ajax" &&
    segments[2] === "content"
  ) {
    return segments[3];
  }

  return null;
}

function buildJob104Posting(
  jobCode: string,
  payload: unknown,
): Job104Posting {
  if (!isRecord(payload)) {
    throw new Job104Error(502, INVALID_RESPONSE_MESSAGE);
  }

  const data = payload.data;

  if (!isRecord(data)) {
    if (hasErrorField(payload)) {
      throw new Job104Error(404, CLOSED_JOB_MESSAGE);
    }

    throw new Job104Error(422, NO_READABLE_TEXT_MESSAGE);
  }

  const header = asRecord(data.header);
  const jobDetail = asRecord(data.jobDetail);
  const condition = asRecord(data.condition);
  const welfare = asRecord(data.welfare);

  const jobName = readInlineField(header.jobName);
  const companyName = readInlineField(header.custName);
  const industry = readMultilineField(data.industry);

  const jobDescription = readMultilineField(jobDetail.jobDescription);
  const jobCategory = readTagList(jobDetail.jobCategory);
  const salary = readMultilineField(jobDetail.salary);
  const address = [
    readInlineField(jobDetail.addressRegion),
    readInlineField(jobDetail.addressArea),
    readInlineField(jobDetail.addressDetail),
  ]
    .filter((part) => part !== "")
    .join(" ");
  const remoteWork = readMultilineField(jobDetail.remoteWork);
  const jobType = readMultilineField(jobDetail.jobType);
  const manageResp = readMultilineField(jobDetail.manageResp);
  const businessTrip = readMultilineField(jobDetail.businessTrip);
  const workPeriod = readMultilineField(jobDetail.workPeriod);

  const workExp = readMultilineField(condition.workExp);
  const edu = readMultilineField(condition.edu);
  const major = readTagList(condition.major);
  const language = readLanguageField(condition.language);
  const specialty = readTagList(condition.specialty);
  const skill = readTagList(condition.skill);
  const certificate = readTagList(condition.certificate);
  const other = readMultilineField(condition.other);

  const welfareText = readMultilineField(welfare.welfare);
  const welfareTags = readTagList(welfare.tag);

  const sections: string[] = [];

  const infoSection = formatSection("【職缺資訊】", [
    formatLabeledLine("職缺名稱", jobName),
    formatLabeledLine("公司名稱", companyName),
    formatLabeledLine("產業類別", industry),
  ]);

  if (infoSection !== "") {
    sections.push(infoSection);
  }

  const contentParagraphs: string[] = [];

  if (jobDescription !== "") {
    contentParagraphs.push(jobDescription);
  }

  const contentLines = [
    formatLabeledLine("職務類別", jobCategory),
    formatLabeledLine("薪資待遇", salary),
    formatLabeledLine("工作地點", address),
    formatLabeledLine("遠端工作", remoteWork),
    formatLabeledLine("職務類型", jobType),
    formatLabeledLine("管理責任", manageResp),
    formatLabeledLine("出差外派", businessTrip),
    formatLabeledLine("上班時段", workPeriod),
  ].filter((line) => line !== "");

  if (contentLines.length > 0) {
    contentParagraphs.push(contentLines.join("\n"));
  }

  if (contentParagraphs.length > 0) {
    sections.push(`【工作內容】\n${contentParagraphs.join("\n\n")}`);
  }

  const conditionSection = formatSection("【工作條件】", [
    formatLabeledLine("工作經歷", workExp),
    formatLabeledLine("學歷要求", edu),
    formatLabeledLine("科系要求", major),
    formatLabeledLine("語文條件", language),
    formatLabeledLine("擅長工具", specialty),
    formatLabeledLine("工作技能", skill),
    formatLabeledLine("證照", certificate),
    formatLabeledLine("其他條件", other),
  ]);

  if (conditionSection !== "") {
    sections.push(conditionSection);
  }

  const welfareLines = [
    welfareText,
    formatLabeledLine("福利標籤", welfareTags),
  ].filter((line) => line !== "");

  if (welfareLines.length > 0) {
    sections.push(`【福利制度】\n${welfareLines.join("\n")}`);
  }

  const text = sections.join("\n\n").trim();

  if (text === "") {
    throw new Job104Error(422, NO_READABLE_TEXT_MESSAGE);
  }

  return {
    jobCode,
    title: buildJob104Title(jobName, companyName),
    text,
  };
}

function buildJob104Title(jobName: string, companyName: string): string {
  const name = collapseToOneLine(jobName);
  const company = collapseToOneLine(companyName);

  if (name !== "" && company !== "") {
    return `${name} - ${company}`.slice(0, MAX_TITLE_LENGTH).trim();
  }

  if (name !== "") {
    return name.slice(0, MAX_TITLE_LENGTH).trim();
  }

  if (company !== "") {
    return company.slice(0, MAX_TITLE_LENGTH).trim();
  }

  return FALLBACK_TITLE;
}

function formatSection(header: string, lines: readonly string[]): string {
  const body = lines.filter((line) => line !== "");

  if (body.length === 0) {
    return "";
  }

  return [header, ...body].join("\n");
}

function formatLabeledLine(label: string, value: string): string {
  return value !== "" ? `${label}：${value}` : "";
}

function readMultilineField(value: unknown): string {
  return extractFieldItems(value).join("\n");
}

function readInlineField(value: unknown): string {
  return extractFieldItems(value)
    .map((item) => collapseToOneLine(item))
    .filter((item) => item !== "")
    .join(" ");
}

function readTagList(value: unknown): string {
  return extractFieldItems(value)
    .map((item) => collapseToOneLine(item))
    .filter((item) => item !== "")
    .join("、");
}

function readLanguageField(value: unknown): string {
  if (!Array.isArray(value)) {
    return readTagList(value);
  }

  const formatted: string[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      const text = extractFieldItem(entry);
      if (text !== "") formatted.push(text);
      continue;
    }

    const lang = collapseToOneLine(
      readTextValue(entry.language) || readTextValue(entry.name),
    );
    const ability = entry.ability;

    if (lang !== "" && isRecord(ability)) {
      const levels = [
        ["聽", ability.listening],
        ["說", ability.speaking],
        ["讀", ability.reading],
        ["寫", ability.writing],
      ]
        .map(([axis, level]) => {
          const val = collapseToOneLine(readTextValue(level));
          return val !== "" ? `${axis}:${val}` : "";
        })
        .filter((part) => part !== "");

      formatted.push(
        levels.length > 0 ? `${lang}（${levels.join(" / ")}）` : lang,
      );
      continue;
    }

    const fallback = extractFieldItem(entry);
    if (fallback !== "") {
      formatted.push(fallback);
    }
  }

  return formatted.join("、");
}

function extractFieldItems(value: unknown): string[] {
  if (typeof value === "string") {
    const text = cleanFieldText(value);
    return text === "" ? [] : [text];
  }

  if (Array.isArray(value)) {
    const items: string[] = [];

    for (const entry of value) {
      const item = extractFieldItem(entry);

      if (item !== "") {
        items.push(item);
      }
    }

    return items;
  }

  const singleItem = extractFieldItem(value);

  return singleItem === "" ? [] : [singleItem];
}

function extractFieldItem(value: unknown): string {
  if (typeof value === "string") {
    return cleanFieldText(value);
  }

  if (!isRecord(value)) {
    return "";
  }

  const label = collapseToOneLine(readTextValue(value.name));
  const ability = collapseToOneLine(readTextValue(value.ability));

  if (label !== "" && ability !== "") {
    return cleanFieldText(`${label}：${ability}`);
  }

  for (const key of FIELD_TEXT_KEYS) {
    const candidate = readTextValue(value[key]);

    if (candidate !== "") {
      return cleanFieldText(candidate);
    }
  }

  return "";
}

function readTextValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function cleanFieldText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .join("\n");
}

function collapseToOneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hasErrorField(payload: Record<string, unknown>): boolean {
  const error = payload.error;

  if (typeof error === "string") {
    return collapseToOneLine(error) !== "";
  }

  return typeof error === "object" && error !== null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Ignore stream cleanup failures for an already-consumed response body.
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function formatTimeoutMessage(timeoutMs: number): string {
  return `The 104 job posting request timed out after ${timeoutMs / 1000} seconds.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimeoutError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  return error.name === "TimeoutError" || error.name === "AbortError";
}
