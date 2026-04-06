// ── SEO Feature Expansion — Shared Types ──────────────────────────────────────

// ── Technical SEO ─────────────────────────────────────────────────────────────

export interface CoreWebVitals {
  url: string;
  lcp: number | null;       // Largest Contentful Paint (ms)
  fid: number | null;       // First Input Delay (ms)
  inp: number | null;       // Interaction to Next Paint (ms)
  cls: number | null;       // Cumulative Layout Shift
  ttfb: number | null;      // Time to First Byte (ms)
  lcpRating: "good" | "needs-improvement" | "poor" | null;
  fidRating: "good" | "needs-improvement" | "poor" | null;
  inpRating: "good" | "needs-improvement" | "poor" | null;
  clsRating: "good" | "needs-improvement" | "poor" | null;
  fetchedAt: string;
}

export interface IndexCoverageItem {
  url: string;
  status: "submitted_indexed" | "crawled_not_indexed" | "excluded" | "error";
  reason?: string;
  lastCrawled?: string;
}

export interface IndexCoverageSummary {
  indexed: number;
  excluded: number;
  error: number;
  total: number;
  items: IndexCoverageItem[];
}

export interface SitemapHealth {
  url: string;
  isValid: boolean;
  urlCount: number;
  lastModified: string | null;
  errors: string[];
  sampleUrls: string[];
  fetchedAt: string;
}

export interface StructuredDataItem {
  url: string;
  types: string[];         // e.g., ["FAQ", "Article", "Product"]
  hasSchema: boolean;
  errors: string[];
}

// ── Competitive Intelligence ──────────────────────────────────────────────────

export interface KeywordGapItem {
  keyword: string;
  searchVolume: number;
  difficulty: number;
  yourPosition: number | null;
  competitorPosition: number;
  competitorDomain: string;
  category: "missing" | "weak" | "strong";
}

export interface SERPFeature {
  query: string;
  features: string[];      // e.g., ["featured_snippet", "people_also_ask", "local_pack"]
  yourUrl: string | null;
  position: number | null;
  hasFeature: boolean;
}

export interface RankTrackerEntry {
  id?: string;
  keyword: string;
  positions: { date: string; position: number }[];
  currentPosition: number;
  previousPosition: number;
  change: number;
  bestPosition: number;
  searchVolume: number;
  url: string | null;
}

// ── Content & On-Page ─────────────────────────────────────────────────────────

export interface ContentDecayItem {
  page: string;
  currentClicks: number;
  previousClicks: number;
  clicksLost: number;
  decayPct: number;
  currentImpressions: number;
  previousImpressions: number;
  period: "30d" | "60d" | "90d";
}

export interface InternalLinkSuggestion {
  sourcePage: string;
  targetPage: string;
  anchorText: string;
  relevanceScore: number;
  reason: string;
}

export interface MetaAuditItem {
  url: string;
  title: string | null;
  titleLength: number;
  description: string | null;
  descriptionLength: number;
  h1: string | null;
  h1Count: number;
  issues: ("missing_title" | "title_too_long" | "title_too_short" | "duplicate_title" |
           "missing_description" | "desc_too_long" | "desc_too_short" |
           "missing_h1" | "multiple_h1")[];
}

export interface ContentScoreItem {
  url: string;
  overallScore: number;        // 0–100
  readabilityScore: number;
  keywordScore: number;
  structureScore: number;
  lengthScore: number;
  wordCount: number;
  suggestions: string[];
}

// ── Backlinks ─────────────────────────────────────────────────────────────────

export interface BacklinkProfile {
  totalBacklinks: number;
  referringDomains: number;
  domainAuthority: number;
  newBacklinks30d: number;
  lostBacklinks30d: number;
  followLinks: number;
  nofollowLinks: number;
  topAnchors: { anchor: string; count: number }[];
  authorityDistribution: { range: string; count: number }[];
  fetchedAt: string;
}

export interface BacklinkItem {
  sourceUrl: string;
  sourceDomain: string;
  targetUrl: string;
  anchorText: string;
  domainRating: number;
  isFollow: boolean;
  firstSeen: string;
  lastSeen: string;
}

export interface ToxicLinkItem {
  domain: string;
  domainRating: number;
  backlinks: number;
  toxicScore: number;        // 0–100
  reasons: string[];
  isFollow: boolean;
}

// ── Reports & Goals ───────────────────────────────────────────────────────────

export interface KPIGoal {
  id?: string;
  keyword: string;
  metric: "position" | "clicks" | "ctr" | "impressions";
  targetValue: number;
  currentValue: number;
  deadline: string;
  createdAt: string;
  status: "on_track" | "at_risk" | "achieved" | "missed";
}

export interface Annotation {
  id?: string;
  date: string;
  label: string;
  color: string;
  category: "content" | "technical" | "algorithm" | "campaign" | "other";
  createdAt: string;
}

export interface WeeklyReport {
  id?: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  clicksChange: number;
  impressionsChange: number;
  avgPositionChange: number;
  topMoversUp: { query: string; change: number }[];
  topMoversDown: { query: string; change: number }[];
  newKeywords: number;
  lostKeywords: number;
  generatedAt: string;
}

// ── Shared ────────────────────────────────────────────────────────────────────

export interface SEOToolsState {
  cwv: CoreWebVitals | null;
  cwvLoading: boolean;
  indexCoverage: IndexCoverageSummary | null;
  indexLoading: boolean;
  sitemap: SitemapHealth | null;
  sitemapLoading: boolean;
  structuredData: StructuredDataItem[];
  structuredDataLoading: boolean;
  metaAudit: MetaAuditItem[];
  metaAuditLoading: boolean;
  contentScores: ContentScoreItem[];
  contentScoreLoading: boolean;
}
