import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.put,
}));

import {
  ResumeParserError,
  parseAndStorePublicLink,
} from "@/lib/resume-parser";
import { ScraperError, fetchJobDescriptionFromUrl } from "@/lib/scraper";

const LONG_JD_TEXT =
  "We are looking for a senior engineer with deep TypeScript, React, Node.js and MongoDB experience. " +
  "You will own system design, API integration, testing and CI/CD across the platform. ".repeat(3);

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = "test-blob-token";
  mocks.put.mockReset().mockResolvedValue({
    url: "https://blob.example.com/resumes/snapshot.txt",
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

describe("fetchJobDescriptionFromUrl", () => {
  it("extracts the title and readable job description text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        htmlResponse(`<!doctype html>
          <html>
            <head><title>Senior Engineer - Acme</title></head>
            <body>
              <nav>Home About Careers</nav>
              <main>
                <h1>Senior Engineer</h1>
                <p>${LONG_JD_TEXT}</p>
                <ul><li>System design</li><li>Bilingual communication</li></ul>
              </main>
              <script>ignoreThisScript()</script>
              <footer>All rights reserved</footer>
            </body>
          </html>`),
      ),
    );

    const result = await fetchJobDescriptionFromUrl(
      "https://example.com/roles/123",
    );

    expect(result.title).toBe("Senior Engineer - Acme");
    expect(result.text).toContain("TypeScript");
    expect(result.text).toContain("System design");
    expect(result.text).not.toContain("ignoreThisScript");
    expect(result.text).not.toContain("Home About Careers");
    expect(result.text).not.toContain("All rights reserved");
    expect(result.url).toBe("https://example.com/roles/123");
  });

  it("rejects local and private network URLs before fetching", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchJobDescriptionFromUrl("http://127.0.0.1/internal/job"),
    ).rejects.toBeInstanceOf(ScraperError);
    await expect(
      fetchJobDescriptionFromUrl("http://192.168.1.10/internal/job"),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      fetchJobDescriptionFromUrl("not-a-url"),
    ).rejects.toMatchObject({ status: 400 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects pages that do not contain enough text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(htmlResponse("<html><body>tiny</body></html>")),
    );

    await expect(
      fetchJobDescriptionFromUrl("https://example.com/empty"),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("parseAndStorePublicLink", () => {
  it("imports a public Google Doc as text and stores a Blob snapshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(LONG_JD_TEXT, {
        status: 200,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await parseAndStorePublicLink(
      "https://docs.google.com/document/d/abc123/edit",
      "google_docs",
    );

    expect(result.sourceType).toBe("google_docs");
    expect(result.sourceUrl).toBe(
      "https://docs.google.com/document/d/abc123/edit",
    );
    expect(result.extractedText).toContain("TypeScript");
    expect(result.fileName.endsWith(".txt")).toBe(true);
    expect(result.blobUrl).toBe(
      "https://blob.example.com/resumes/snapshot.txt",
    );

    const fetchCall = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    expect(fetchCall?.[0]).toBe(
      "https://docs.google.com/document/d/abc123/export?format=txt",
    );

    const putCall = mocks.put.mock.calls[0] as
      | [string, string, Record<string, unknown>]
      | undefined;
    expect(putCall?.[0]).toContain("google-docs");
    expect(putCall?.[0].endsWith(".txt")).toBe(true);
    expect(putCall?.[1]).toContain("TypeScript");
    expect(putCall?.[2]).toMatchObject({
      access: "public",
      contentType: "text/plain; charset=utf-8",
      token: "test-blob-token",
    });
  });

  it("returns a helpful error for a non-public link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => new Response("forbidden", { status: 403 })),
    );

    const resultPromise = parseAndStorePublicLink(
      "https://www.notion.so/private-resume-123",
      "notion",
    );

    await expect(resultPromise).rejects.toBeInstanceOf(ResumeParserError);
    await expect(resultPromise).rejects.toMatchObject({ status: 502 });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("extracts readable text from a *.notion.site public SPA page via Notion API v3", async () => {
    const pageId = "b49b10bb-cfd4-4024-9ca4-aed71be658df";
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL) => {
      const target = String(input);

      if (target.endsWith("/api/v3/loadCachedPageChunk")) {
        return new Response(
          JSON.stringify({
            cursor: { stack: [] },
            recordMap: {
              block: {
                [pageId]: {
                  value: {
                    role: "reader",
                    value: {
                      id: pageId,
                      type: "page",
                      properties: { title: [["Resume"]] },
                      content: ["col-list-1"],
                    },
                  },
                },
                "col-list-1": {
                  value: {
                    id: "col-list-1",
                    type: "column_list",
                    content: ["col-1"],
                  },
                },
                "col-1": {
                  value: {
                    id: "col-1",
                    type: "column",
                    content: ["hdr-1", "blk-1", "bul-1"],
                  },
                },
                "hdr-1": {
                  value: {
                    value: {
                      id: "hdr-1",
                      type: "sub_header",
                      properties: { title: [["Summary"]] },
                    },
                  },
                },
                "blk-1": {
                  value: {
                    value: {
                      id: "blk-1",
                      type: "text",
                      properties: {
                        title: [
                          [
                            "Senior RF Engineer with automated Python testing and ADS/HFSS simulation experience.",
                          ],
                        ],
                      },
                    },
                  },
                },
                "bul-1": {
                  value: {
                    value: {
                      id: "bul-1",
                      type: "bulleted_list",
                      properties: { title: [["RF System Architecture & Calibration"]] },
                    },
                  },
                },
              },
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      return htmlResponse(
        "<html><body><noscript>Notion JavaScript must be enabled</noscript></body></html>",
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const notionUrl =
      "https://pricewu-workspace.notion.site/Resume-b49b10bbcfd440249ca4aed71be658df?source=copy_link";

    const resumeResult = await parseAndStorePublicLink(notionUrl, "notion");
    expect(resumeResult.sourceType).toBe("notion");
    expect(resumeResult.extractedText).toContain("Summary");
    expect(resumeResult.extractedText).toContain("Senior RF Engineer");
    expect(resumeResult.extractedText).toContain(
      "- RF System Architecture & Calibration",
    );
    expect(mocks.put).toHaveBeenCalledTimes(1);

    const jdResult = await fetchJobDescriptionFromUrl(notionUrl);
    expect(jdResult.title).toBe("Resume");
    expect(jdResult.text).toContain("Senior RF Engineer");
    expect(jdResult.url).toBe(notionUrl);
  });

  it("merges paginated Notion chunks and resolves friendly slug via getPublicPageData", async () => {
    const pageId = "11111111-2222-3333-4444-555555555555";
    const fetchMock = vi.fn().mockImplementation(async (input: string | URL, init?: RequestInit) => {
      const target = String(input);

      if (target.endsWith("/api/v3/getPublicPageData")) {
        return new Response(JSON.stringify({ pageId }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (target.endsWith("/api/v3/loadCachedPageChunk")) {
        const parsedBody = JSON.parse(String(init?.body ?? "{}")) as {
          chunkNumber?: number;
        };

        if (parsedBody.chunkNumber === 0) {
          return new Response(
            JSON.stringify({
              cursor: { stack: [["next"]] },
              recordMap: {
                block: {
                  [pageId]: {
                    value: {
                      id: pageId,
                      type: "page",
                      properties: { title: [["Staff Backend Engineer"]] },
                      content: ["b1", "b2"],
                    },
                  },
                  b1: {
                    value: {
                      id: "b1",
                      type: "text",
                      properties: { title: [["Distributed APIs in TypeScript and Node.js."]] },
                    },
                  },
                },
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            cursor: { stack: [] },
            recordMap: {
              block: {
                b2: {
                  value: {
                    id: "b2",
                    type: "to_do",
                    properties: {
                      title: [["Build reliable MongoDB indexing pipelines"]],
                      checked: [["Yes"]],
                    },
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }

      return htmlResponse("<html><body></body></html>");
    });
    vi.stubGlobal("fetch", fetchMock);

    const jdResult = await fetchJobDescriptionFromUrl(
      "https://example.notion.site/staff-backend-engineer",
    );

    expect(jdResult.title).toBe("Staff Backend Engineer");
    expect(jdResult.text).toContain("Distributed APIs in TypeScript and Node.js.");
    expect(jdResult.text).toContain("[x] Build reliable MongoDB indexing pipelines");
  });
});
