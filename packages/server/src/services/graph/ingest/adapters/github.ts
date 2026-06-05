import { SourceAdapter, RawLead, LeadCandidate, Signal } from "../types.js";

const GITHUB_API = "https://api.github.com";

const DIAGNOSTIC_KEYWORDS = [
  "diagnostics", "immunoassay", "elisa", "ivd", "in-vitro",
  "assay", "antibody", "antigen", "hemostasis", "clinical-chemistry",
  "biomarker", "point-of-care", "lateral-flow", "microfluidics",
];

function mapTopicsToApplications(topics: string[]): string[] {
  const apps: string[] = [];
  const lower = topics.map((t) => t.toLowerCase());
  if (lower.some((t) => ["hemostasis", "coagulation", "thrombosis"].includes(t))) apps.push("Hemostasis & Thrombosis");
  if (lower.some((t) => ["immunoassay", "elisa", "antibody", "serology"].includes(t))) apps.push("Infectious Disease & Serology");
  if (lower.some((t) => ["biomarker", "cancer", "oncology", "tumor"].includes(t))) apps.push("Oncology & Tumor Markers");
  if (lower.some((t) => ["cardiac", "troponin", "heart"].includes(t))) apps.push("Cardiac Markers");
  if (lower.some((t) => ["autoimmune", "autoimmunity", "ana"].includes(t))) apps.push("Autoimmune Diagnostics");
  if (lower.some((t) => ["protein", "plasma", "serum", "nephelometry"].includes(t))) apps.push("Plasma Proteins");
  if (lower.some((t) => ["chemistry", "reagent", "clinical-chemistry"].includes(t))) apps.push("Specialty Proteins & Reagents");
  if (apps.length === 0) apps.push("Infectious Disease & Serology");
  return apps;
}

export class GitHubSourceAdapter implements SourceAdapter {
  readonly id = "github";
  readonly name = "GitHub Organizations";
  readonly description = "GitHub companies with diagnostics-related repositories";

  private token: string | undefined;

  constructor(token?: string) {
    this.token = token;
  }

  private async ghFetch(path: string): Promise<any> {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "LeadGraph/1.0",
    };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    try {
      const res = await fetch(`${GITHUB_API}${path}`, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        if (res.status === 403) console.warn("GitHub rate limited. Set GITHUB_TOKEN env var for higher limits.");
        return null;
      }
      return res.json();
    } catch {
      return null;
    }
  }

  async fetch(): Promise<RawLead[]> {
    const leads: RawLead[] = [];
    const seenOrgs = new Set<string>();

    for (const keyword of DIAGNOSTIC_KEYWORDS) {
      const results = await this.ghFetch(
        `/search/repositories?q=${keyword}+in:name,description,topics&sort=updated&per_page=10`
      );
      if (!results?.items) continue;

      for (const repo of results.items) {
        const owner = repo.owner;
        if (!owner || owner.type === "User") continue;
        if (seenOrgs.has(owner.login)) continue;
        seenOrgs.add(owner.login);

        let orgDescription: string = owner.description ?? owner.login;
        try {
          const orgDetail = await this.ghFetch(`/orgs/${owner.login}`);
          if (orgDetail?.description) orgDescription = orgDetail.description;
        } catch { /* use default */ }

        const repoTopics: string[] = repo.topics ?? [];
        const allRepos = await this.ghFetch(`/orgs/${owner.login}/repos?per_page=5&sort=updated`);
        const repoList: string[] = [];
        const allTopics = new Set(repoTopics);
        if (Array.isArray(allRepos)) {
          for (const r of allRepos) {
            repoList.push(r.full_name);
            if (r.topics) r.topics.forEach((t: string) => allTopics.add(t));
          }
        }

        leads.push({
          sourceId: `gh-${owner.login}`,
          sourceUrl: owner.html_url,
          raw: {
            login: owner.login,
            description: orgDescription,
            repos: repoList,
            topics: Array.from(allTopics),
            createdAt: owner.created_at ?? new Date().toISOString(),
          } as unknown as Record<string, unknown>,
        });
      }
    }

    return leads;
  }

  normalize(raw: RawLead): LeadCandidate {
    const org = raw.raw as Record<string, unknown>;
    const login = org.login as string;
    const description = (org.description as string) ?? `${login} — GitHub organization active in diagnostics`;
    const topics = (org.topics as string[]) ?? [];
    const repos = (org.repos as string[]) ?? [];
    const createdAt = (org.createdAt as string) ?? new Date().toISOString();

    const applications = mapTopicsToApplications(topics);

    const signals: Signal[] = [
      {
        type: "NEWS",
        date: createdAt.slice(0, 10),
        confidence: 0.5,
        description: `Active GitHub org with ${repos.length} diagnostic repos. Topics: ${topics.slice(0, 5).join(", ")}`,
        url: raw.sourceUrl,
      },
    ];

    return {
      sourceId: raw.sourceId,
      companyName: login,
      domain: `${login.toLowerCase()}.com`,
      description,
      applicationAreas: applications,
      signals,
    };
  }

  async healthCheck(): Promise<boolean> {
    const result = await this.ghFetch("/rate_limit");
    return result !== null && result.resources?.core?.remaining > 0;
  }
}
