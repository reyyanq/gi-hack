// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContactCandidate {
  name: string;
  role: string;
  email: string | null;
  confidence: number; // 0–1
  source: "llm" | "scrape" | "pattern" | "linkedin" | "api";
}

export interface ContactFinderInput {
  companyName: string;
  domain: string;
  segment?: string;
  tier?: string;
  signals: string[]; // top signal descriptions
  applications?: string[];
}

export interface ContactFinderResult {
  companyName: string;
  contacts: ContactCandidate[];
  method: string;
}

// ─── Strategy Interface (pluggable) ──────────────────────────────────────────

export interface ContactFinderStrategy {
  name: string;
  find(input: ContactFinderInput): Promise<ContactCandidate[]>;
}

// ─── Strategy 1: LLM-based contact suggestion (primary) ──────────────────────

export class LLMContactStrategy implements ContactFinderStrategy {
  name = "llm";
  private endpoint: string;
  private model: string;

  constructor() {
    this.endpoint = process.env.LLM_ENDPOINT || "http://localhost:11434/v1/chat/completions";
    this.model = process.env.LLM_MODEL || "llama3";
  }

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    const signalSummary = input.signals.slice(0, 5).join("; ") || "No signals available";

    const messages = [
      {
        role: "system",
        content: `You are a B2B sales intelligence agent. Given a company profile, suggest realistic R&D and procurement contacts.

Return a JSON array of contacts. Each contact has: name (full name), role (specific title), email (corporate pattern), confidence (0-1). Rules: 2-4 contacts max, prefer R&D leadership, include procurement for large companies. Return ONLY valid JSON array, no markdown.`,
      },
      {
        role: "user",
        content: [
          `Company: ${input.companyName}`,
          `Domain: ${input.domain}`,
          `Segment: ${input.segment ?? "Unknown"}`,
          `Tier: ${input.tier ?? "Unknown"}`,
          `Applications: ${(input.applications ?? []).join(", ") || "Unknown"}`,
          `Key signals: ${signalSummary}`,
        ].join("\n"),
      },
    ];

    try {
      const resp = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          stream: false,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) return [];

      const body = await resp.json() as any;
      const text = body.choices?.[0]?.message?.content || "";

      const parsed = JSON.parse(text.trim());
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((c: any) => c.name && c.role)
        .map((c: any) => ({
          name: c.name,
          role: c.role,
          email: c.email && typeof c.email === "string" && c.email.includes("@")
            ? c.email.toLowerCase()
            : null,
          confidence: Math.min(1, Math.max(0, c.confidence ?? 0.3)),
          source: "llm" as const,
        }));
    } catch {
      return [];
    }
  }
}

// ─── Strategy 2: LinkedIn search (Playwright) ────────────────────────────────

export class LinkedInStrategy implements ContactFinderStrategy {
  name = "linkedin";

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    try {
      const { chromium } = await import("playwright");
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36" });
      const page = await context.newPage();

      const results: ContactCandidate[] = [];
      try {
        const query = `site:linkedin.com/in/ "${input.companyName}"`;
        await page.goto(`https://www.google.com/search?q=${encodeURIComponent(query)}`, { waitUntil: "networkidle", timeout: 10000 });

        const snippets = await page.$$eval("div.g", (divs) =>
          divs.map((d) => {
            const title = d.querySelector("h3")?.textContent ?? "";
            const snippet = d.querySelector(".VwiC3b")?.textContent ?? "";
            const link = d.querySelector("a")?.href ?? "";
            return { title, snippet, link };
          }),
        );

        for (const s of snippets) {
          const title = s.title.replace(/ - LinkedIn$/, "").trim();
          const parts = title.split(" - ");
          if (parts.length < 2) continue;
          const name = parts[0].trim();
          const role = parts[1].trim();
          if (!name || name.length < 3) continue;

          const email = generateEmailFromName(name, input.domain);
          results.push({
            name,
            role,
            email,
            confidence: email ? 0.6 : 0.4,
            source: "linkedin",
          });
        }

        // Second search: look for broader LinkedIn pages mentioning the company
        if (results.length < 3) {
          const broadQuery = `"${input.companyName}" linkedin "people also viewed" OR "similar pages"`;
          await page.goto(`https://www.google.com/search?q=${encodeURIComponent(broadQuery)}&start=10`, { waitUntil: "networkidle", timeout: 10000 });

          const extraSnippets = await page.$$eval("div.g", (divs) =>
            divs.map((d) => {
              const title = d.querySelector("h3")?.textContent ?? "";
              const snippet = d.querySelector(".VwiC3b")?.textContent ?? "";
              return { title, snippet };
            }),
          );

          for (const s of extraSnippets) {
            const clean = s.title.replace(/ - LinkedIn$/, "").trim();
            const parts = clean.split(" - ");
            if (parts.length < 2) continue;
            const name = parts[0].trim();
            const role = parts[1].trim();
            if (!name || name.length < 3) continue;
            if (results.some((r) => r.name === name)) continue;

            const email = generateEmailFromName(name, input.domain);
            results.push({
              name,
              role,
              email,
              confidence: email ? 0.5 : 0.35,
              source: "linkedin",
            });
          }
        }
      } catch {
        // Search failure — return what we have
      } finally {
        await browser.close().catch(() => {});
      }

      return results;
    } catch {
      return [];
    }
  }
}

function generateEmailFromName(name: string, domain: string): string | null {
  const parts = name.toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return `${parts[0]}.${parts[parts.length - 1]}@${domain}`;
}

// ─── Strategy 3: Web scraping with Playwright (fallback 1) ────────────────────

export class WebScrapeStrategy implements ContactFinderStrategy {
  name = "scrape";

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    if (!input.domain) return [];

    const url = `https://${input.domain}`;
    let html = "";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      html = await resp.text();
    } catch {
      return [];
    }

    const candidates: ContactCandidate[] = [];

    // Look for email addresses in the page
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = [...new Set(html.match(emailRegex) ?? [])]
      .filter((e) => !e.includes("example.com") && !e.includes("domain.com"))
      .slice(0, 5);

    for (const email of emails) {
      // Try to extract a name from the email
      const localPart = email.split("@")[0];
      const nameGuess = localPart
        .replace(/[._]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();

      candidates.push({
        name: nameGuess || "Unknown",
        role: "Unknown (scraped)",
        email,
        confidence: 0.5,
        source: "scrape",
      });
    }

    // Look for "team", "about", "contact" page links
    const linkRegex = /href=["']([^"']*(?:team|about|contact|people|leadership)[^"']*)["']/gi;
    const links = [...new Set(html.match(linkRegex) ?? [])].slice(0, 3);

    if (links.length > 0) {
      candidates.push({
        name: `Found team/contact pages: ${links.length}`,
        role: "See website",
        email: null,
        confidence: 0.3,
        source: "scrape",
      });
    }

    return candidates;
  }
}

// ─── Strategy 3: Email pattern generator (lightweight fallback) ──────────────

const EMAIL_PATTERNS = [
  (first: string, last: string, domain: string) => `${first}.${last}@${domain}`,
  (first: string, last: string, domain: string) => `${first[0]}.${last}@${domain}`,
  (first: string, _last: string, domain: string) => `${first}@${domain}`,
  (first: string, last: string, domain: string) => `${first}${last[0]}@${domain}`,
  (_first: string, last: string, domain: string) => `${last}@${domain}`,
];

function generateEmail(name: string, domain: string): string {
  const parts = name.toLowerCase().trim().split(/\s+/);
  if (parts.length < 2 || !domain) return "";
  const first = parts[0];
  const last = parts[parts.length - 1];
  for (const pattern of EMAIL_PATTERNS) {
    const email = pattern(first, last, domain);
    if (email.length < `${first}@${domain}`.length + 5) continue;
    return email;
  }
  return `${first}.${last}@${domain}`;
}

export class PatternEmailStrategy implements ContactFinderStrategy {
  name = "pattern";

  async find(input: ContactFinderInput): Promise<ContactCandidate[]> {
    if (!input.domain) return [];
    return [
      {
        name: `R&D Director`,
        role: "Director of R&D",
        email: generateEmail("R&D Director", input.domain),
        confidence: 0.2,
        source: "pattern",
      },
      {
        name: `Procurement Manager`,
        role: "Procurement Manager",
        email: generateEmail("Procurement Manager", input.domain),
        confidence: 0.15,
        source: "pattern",
      },
    ];
  }
}

// ─── Orchestrator: runs strategies in order, merges results ───────────────────

export class ContactFinder {
  private strategies: ContactFinderStrategy[];

  constructor(strategies?: ContactFinderStrategy[]) {
    // LLM → web scrape → LinkedIn (placeholder) → pattern (last resort)
    this.strategies = strategies ?? [
      new LLMContactStrategy(),
      new WebScrapeStrategy(),
      new LinkedInStrategy(),
      new PatternEmailStrategy(),
    ];
  }

  /** Register a new strategy (pluggable). */
  use(strategy: ContactFinderStrategy): void {
    this.strategies.push(strategy);
  }

  /** Run all strategies, return merged deduplicated results. */
  async findContacts(input: ContactFinderInput): Promise<ContactFinderResult> {
    const allContacts: ContactCandidate[] = [];
    let usedMethod = "none";

    for (const strategy of this.strategies) {
      try {
        const contacts = await strategy.find(input);
        if (contacts.length > 0) {
          allContacts.push(...contacts);
          usedMethod = strategy.name;
          // LLM results are good enough — stop there
          if (strategy.name === "llm") break;
        }
      } catch {
        // Strategy failed — try next
        continue;
      }
    }

    // Deduplicate by email
    const seen = new Set<string>();
    const unique = allContacts.filter((c) => {
      const key = c.email ?? c.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by confidence descending
    unique.sort((a, b) => b.confidence - a.confidence);

    return {
      companyName: input.companyName,
      contacts: unique,
      method: usedMethod,
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let defaultFinder: ContactFinder | null = null;

export function getContactFinder(): ContactFinder {
  if (!defaultFinder) {
    defaultFinder = new ContactFinder();
  }
  return defaultFinder;
}
