import { describe, expect, it } from "vitest";
import { fakeFetch, type Route } from "../fixtures/responses";
import { contentKey, jobDraft, jobFromText, jobKey, parseJobTitle, toIsoDate } from "./job";

const page = (head: string) => ({ body: `<html><head>${head}</head><body></body></html>`, headers: { "content-type": "text/html" } }) satisfies Route;
const ld = (job: object) => `<script type="application/ld+json">${JSON.stringify(job)}</script>`;
const run = (url: string, route: Route) => jobDraft(url, { fetch: fakeFetch({ [url.split("?")[0]]: route }) });

describe("jobKey", () => {
  it("unifies LinkedIn URL variants on the job id", () => {
    const a = jobKey("https://www.linkedin.com/jobs/view/senior-designer-at-acme-3912345678?trackingId=x");
    const b = jobKey("https://linkedin.com/jobs/view/3912345678/");
    const c = jobKey("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3912345678");
    expect(a.canonicalKey).toBe("job:linkedin:3912345678");
    expect(b.canonicalKey).toBe(a.canonicalKey);
    expect(c.canonicalKey).toBe(a.canonicalKey);
    expect(a.canonicalUrl).toBe("https://www.linkedin.com/jobs/view/3912345678");
  });
  it("strips tracking from other links and rejects unsafe ones", () => {
    expect(jobKey("https://boards.greenhouse.io/acme/jobs/1?utm_source=x").canonicalKey).toBe("job:site:boards.greenhouse.io/acme/jobs/1");
    expect(() => jobKey("http://localhost/jobs/1")).toThrow();
  });
});

describe("contentKey", () => {
  it("is stable for the same content and differs otherwise", () => {
    expect(contentKey("hello")).toBe(contentKey("hello"));
    expect(contentKey("hello")).not.toBe(contentKey("hello2"));
    expect(contentKey(new Uint8Array([1, 2, 3]))).toMatch(/^job:text:[0-9a-f]{24}$/);
  });
});

describe("toIsoDate", () => {
  it("reads ISO dates and prose dates, and ignores junk", () => {
    expect(toIsoDate("2026-03-04T10:00:00Z")).toBe("2026-03-04");
    expect(toIsoDate("March 4, 2026")).toBe("2026-03-04");
    expect(toIsoDate("soon")).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });
});

describe("parseJobTitle", () => {
  it("reads the common title shapes", () => {
    expect(parseJobTitle("Acme hiring Senior Designer in Berlin, Germany | LinkedIn")).toEqual({ company: "Acme", role: "Senior Designer", location: "Berlin, Germany" });
    expect(parseJobTitle("Product Designer at Acme")).toEqual({ company: "Acme", role: "Product Designer", location: null });
    expect(parseJobTitle("Product Designer - Acme | Greenhouse")).toEqual({ company: "Acme", role: "Product Designer", location: null });
    expect(parseJobTitle("Designer")).toEqual({ company: null, role: "Designer", location: null });
  });
});

describe("jobDraft", () => {
  const url = "https://jobs.example.com/acme/123";

  it("prefers schema.org JobPosting data", async () => {
    const d = await run(
      url,
      page(
        ld({
          "@context": "https://schema.org",
          "@type": "JobPosting",
          title: "Design Engineer",
          hiringOrganization: { "@type": "Organization", name: "Acme &amp; Co" },
          jobLocation: { address: { addressLocality: "Pune", addressCountry: "IN" } },
          datePosted: "2026-02-10T08:00:00Z",
          description: "<p>Build <b>things</b>.</p>",
        }),
      ),
    );
    expect(d).toMatchObject({ company: "Acme & Co", role: "Design Engineer", location: "Pune, IN", postedAt: "2026-02-10", description: "Build things .", errors: [] });
  });

  it("finds a JobPosting inside @graph and marks remote roles", async () => {
    const d = await run(url, page(ld({ "@graph": [{ "@type": "WebSite" }, { "@type": "JobPosting", title: "Designer", hiringOrganization: "Acme", jobLocationType: "TELECOMMUTE" }] })));
    expect(d).toMatchObject({ role: "Designer", company: "Acme", location: "Remote" });
  });

  it("falls back to the page title when there is no structured data", async () => {
    const d = await run(url, page(`<meta property="og:title" content="Acme hiring Motion Designer in Remote | LinkedIn"><meta property="og:description" content="About the job">`));
    expect(d).toMatchObject({ company: "Acme", role: "Motion Designer", location: "Remote", description: "About the job", errors: [] });
  });

  it("survives a broken ld+json block", async () => {
    const d = await run(url, page(`<script type="application/ld+json">{nope</script><title>Designer at Acme</title>`));
    expect(d).toMatchObject({ company: "Acme", role: "Designer" });
  });

  it("reports an authwall or a blocked page with a way forward, without throwing", async () => {
    const wall = await run(url, page(`<title>Sign Up | LinkedIn</title><meta property="og:title" content="Sign Up | LinkedIn">`));
    expect(wall.errors[0]).toMatchObject({ code: "authwall" });
    expect(wall.errors[0].message).toContain("Paste the posting text");
    const blocked = await run(url, { status: 403, body: "" });
    expect(blocked.errors[0].code).toBe("blocked");
    expect(blocked.canonicalKey).toBe("job:site:jobs.example.com/acme/123");
  });

  it("reports a closed posting and an empty page", async () => {
    expect((await run(url, { status: 404, body: "" })).errors[0].code).toBe("not-found");
    expect((await run(url, page(""))).errors[0].code).toBe("failed");
  });

  it("reports a network failure instead of throwing", async () => {
    const d = await run(url, { throws: "network" });
    expect(d.errors).toHaveLength(1);
    expect(d.role).toBe("");
  });
});

describe("jobFromText", () => {
  it("reads labelled lines", () => {
    const d = jobFromText("Senior Designer\nCompany: Acme\nLocation: Remote, India\nPosted: 2026-01-05\n\nWe are hiring.");
    expect(d).toMatchObject({ company: "Acme", role: "Senior Designer", location: "Remote, India", postedAt: "2026-01-05", canonicalUrl: null });
  });

  it("uses the first line as the role when nothing is labelled", () => {
    expect(jobFromText("Product Designer at Acme\nBangalore\nLong text here")).toMatchObject({ role: "Product Designer", company: "Acme" });
  });

  it("keeps the link's key when a link came with the text", () => {
    const d = jobFromText("Designer", { canonicalUrl: "https://www.linkedin.com/jobs/view/1234567", canonicalKey: "job:linkedin:1234567" });
    expect(d).toMatchObject({ canonicalUrl: "https://www.linkedin.com/jobs/view/1234567", canonicalKey: "job:linkedin:1234567" });
  });

  it("gives the same key to the same pasted text", () => {
    expect(jobFromText("Designer at Acme").canonicalKey).toBe(jobFromText("Designer at Acme ").canonicalKey);
  });
});
