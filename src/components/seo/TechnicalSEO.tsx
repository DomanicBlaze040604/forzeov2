import { useState, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Gauge, Shield, FileSearch, Code2, Loader2, RefreshCw,
  CheckCircle, XCircle, AlertTriangle, ExternalLink, Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callSEOFunction, ratingColor, ratingBg, cwvRating, fmtNum, truncateUrl } from "./helpers";
import type {
  CoreWebVitals, SitemapHealth, MetaAuditItem,
  IndexCoverageSummary, StructuredDataItem,
} from "./types";

// ── Sub-components ────────────────────────────────────────────────────────────

function CWVGauge({ label, value, unit, rating }: {
  label: string; value: number | null; unit: string;
  rating: "good" | "needs-improvement" | "poor" | null;
}) {
  const pct = value === null ? 0
    : label === "CLS" ? Math.min(100, (value / 0.5) * 100)
    : Math.min(100, (value / 6000) * 100);

  const barColor = rating === "good" ? "#10b981"
    : rating === "needs-improvement" ? "#f59e0b"
    : rating === "poor" ? "#ef4444" : "#d1d5db";

  return (
    <div className={cn("rounded-2xl border p-5 flex flex-col gap-3", ratingBg(rating))}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full",
          rating === "good" ? "bg-emerald-100 text-emerald-700"
          : rating === "needs-improvement" ? "bg-amber-100 text-amber-700"
          : rating === "poor" ? "bg-rose-100 text-rose-700"
          : "bg-gray-100 text-gray-500"
        )}>
          {rating === "good" ? "Good" : rating === "needs-improvement" ? "Needs Work" : rating === "poor" ? "Poor" : "N/A"}
        </span>
      </div>
      <p className={cn("text-3xl font-bold tabular-nums", ratingColor(rating))}>
        {value !== null ? (label === "CLS" ? value.toFixed(3) : `${Math.round(value)}`) : "—"}
        {value !== null && <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface TechnicalSEOProps {
  clientId: string;
  siteUrl: string | null;
}

export default function TechnicalSEO({ clientId, siteUrl }: TechnicalSEOProps) {
  const [activePanel, setActivePanel] = useState<"cwv" | "sitemap" | "meta" | "index">("cwv");

  // CWV state
  const [cwvData, setCwvData] = useState<{ mobile: CoreWebVitals; desktop: CoreWebVitals } | null>(null);
  const [cwvLoading, setCwvLoading] = useState(false);
  const [cwvDevice, setCwvDevice] = useState<"mobile" | "desktop">("mobile");

  // Sitemap state
  const [sitemapData, setSitemapData] = useState<SitemapHealth | null>(null);
  const [sitemapLoading, setSitemapLoading] = useState(false);

  // Meta audit state
  const [metaData, setMetaData] = useState<MetaAuditItem[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);

  // Index coverage state
  const [indexData, setIndexData] = useState<IndexCoverageSummary | null>(null);
  const [indexLoading, setIndexLoading] = useState(false);
  const [indexCheckUrl, setIndexCheckUrl] = useState("");

  // ── Auto-load Cache ─────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!clientId) return;
    const loadCache = async () => {
      try {
        const res = await callSEOFunction("seo-tools", "get_all_audits", clientId, {});
        const audits = res.audits || [];
        
        const cachedCwv = audits.find((a: any) => a.audit_type === "core_web_vitals");
        if (cachedCwv) setCwvData(cachedCwv.data);

        const cachedSitemap = audits.find((a: any) => a.audit_type === "sitemap");
        if (cachedSitemap) setSitemapData(cachedSitemap.data);

        const cachedMeta = audits.find((a: any) => a.audit_type === "meta_audit");
        if (cachedMeta) setMetaData(cachedMeta.data.results || []);

        const cachedIndex = audits.find((a: any) => a.audit_type === "index_coverage");
        if (cachedIndex) setIndexData(cachedIndex.data);

      } catch (err) {
        console.error("Failed to load SEO cache:", err);
      }
    };
    loadCache();
  }, [clientId]);

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchCWV = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setCwvLoading(true);
    try {
      const data = await callSEOFunction("seo-tools", "core_web_vitals", clientId, { site_url: siteUrl });
      setCwvData(data);
      toast.success("Core Web Vitals loaded");
    } catch (err: any) {
      toast.error("CWV fetch failed: " + err.message);
    } finally {
      setCwvLoading(false);
    }
  }, [clientId, siteUrl]);

  const fetchSitemap = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setSitemapLoading(true);
    try {
      const data = await callSEOFunction("seo-tools", "sitemap_audit", clientId, { site_url: siteUrl });
      setSitemapData(data);
      toast.success("Sitemap audit complete");
    } catch (err: any) {
      toast.error("Sitemap fetch failed: " + err.message);
    } finally {
      setSitemapLoading(false);
    }
  }, [clientId, siteUrl]);

  const fetchMetaAudit = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setMetaLoading(true);
    try {
      // First get sitemap URLs, then audit them
      let urls: string[] = [];
      try {
        const sm = await callSEOFunction("seo-tools", "sitemap_audit", clientId, { site_url: siteUrl });
        urls = sm.sampleUrls || [];
      } catch { /* fallback to site root */ }
      if (urls.length === 0) urls = [siteUrl];

      const data = await callSEOFunction("seo-tools", "meta_audit", clientId, { urls });
      setMetaData(data.results || []);
      toast.success(`Audited ${data.results?.length || 0} pages`);
    } catch (err: any) {
      toast.error("Meta audit failed: " + err.message);
    } finally {
      setMetaLoading(false);
    }
  }, [clientId, siteUrl]);

  const fetchIndexCoverage = useCallback(async (customUrls?: string[]) => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setIndexLoading(true);
    try {
      let urls = customUrls || [];
      if (urls.length === 0) {
        try {
          const sm = await callSEOFunction("seo-tools", "sitemap_audit", clientId, { site_url: siteUrl });
          urls = sm.sampleUrls?.slice(0, 10) || [siteUrl];
        } catch { urls = [siteUrl]; }
      }
      const data = await callSEOFunction("seo-tools", "index_coverage", clientId, { urls, site_url: siteUrl });
      setIndexData(data);
      toast.success(`Checked ${data.total} URLs`);
    } catch (err: any) {
      toast.error("Index check failed: " + err.message);
    } finally {
      setIndexLoading(false);
    }
  }, [clientId, siteUrl]);

  const cwv = cwvData ? cwvData[cwvDevice] : null;
  const issueCount = metaData.reduce((s, m) => s + m.issues.length, 0);

  const panels = [
    { id: "cwv", label: "Core Web Vitals", icon: Gauge },
    { id: "sitemap", label: "Sitemap Health", icon: Globe2 },
    { id: "meta", label: "Meta Tag Audit", icon: FileSearch },
    { id: "index", label: "Index Coverage", icon: Shield },
  ] as const;

  return (
    <div className="space-y-5">
      {/* Panel nav */}
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit flex-wrap">
        {panels.map(p => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activePanel === p.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700")}>
            <p.icon className="h-3.5 w-3.5" />{p.label}
          </button>
        ))}
      </div>

      {/* ── Core Web Vitals ───────────────────────────────────────────────── */}
      {activePanel === "cwv" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Core Web Vitals</h3>
              <p className="text-xs text-gray-500 mt-0.5">Chrome UX Report (CrUX) real-user data</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                {(["mobile", "desktop"] as const).map(d => (
                  <button key={d} onClick={() => setCwvDevice(d)}
                    className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all capitalize",
                      cwvDevice === d ? "bg-white shadow-sm text-gray-800" : "text-gray-500")}>
                    {d}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={fetchCWV} disabled={cwvLoading} className="gap-2 text-xs h-8">
                {cwvLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Fetch CWV
              </Button>
            </div>
          </div>

          {!cwvData ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Gauge className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Fetch CWV" to load Core Web Vitals from Chrome UX Report</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <CWVGauge label="LCP" value={cwv?.lcp ?? null} unit="ms" rating={cwvRating("lcp", cwv?.lcp ?? null)} />
              <CWVGauge label="INP" value={cwv?.inp ?? null} unit="ms" rating={cwvRating("inp", cwv?.inp ?? null)} />
              <CWVGauge label="CLS" value={cwv?.cls ?? null} unit="" rating={cwvRating("cls", cwv?.cls ?? null)} />
              <CWVGauge label="TTFB" value={cwv?.ttfb ?? null} unit="ms" rating={cwvRating("lcp", cwv?.ttfb ?? null)} />
            </div>
          )}
        </div>
      )}

      {/* ── Sitemap Health ────────────────────────────────────────────────── */}
      {activePanel === "sitemap" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Sitemap Health Check</h3>
              <p className="text-xs text-gray-500 mt-0.5">Validates sitemap.xml structure and URL coverage</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSitemap} disabled={sitemapLoading} className="gap-2 text-xs h-8">
              {sitemapLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Audit Sitemap
            </Button>
          </div>

          {!sitemapData ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Globe2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Audit Sitemap" to check your sitemap.xml</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={cn("rounded-2xl border p-5", sitemapData.isValid ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200")}>
                <div className="flex items-center gap-2 mb-2">
                  {sitemapData.isValid ? <CheckCircle className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-rose-500" />}
                  <span className="text-sm font-bold text-gray-800">Status</span>
                </div>
                <p className={cn("text-2xl font-bold", sitemapData.isValid ? "text-emerald-600" : "text-rose-600")}>
                  {sitemapData.isValid ? "Valid" : "Invalid"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <span className="text-xs font-semibold text-gray-500 uppercase">URLs Found</span>
                <p className="text-2xl font-bold text-gray-900 mt-1">{fmtNum(sitemapData.urlCount)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <span className="text-xs font-semibold text-gray-500 uppercase">Last Modified</span>
                <p className="text-lg font-bold text-gray-900 mt-1">{sitemapData.lastModified || "Unknown"}</p>
              </div>

              {sitemapData.errors.length > 0 && (
                <div className="col-span-full bg-rose-50 border border-rose-200 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-rose-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" /> Issues Found
                  </h4>
                  <ul className="space-y-1">
                    {sitemapData.errors.map((e, i) => (
                      <li key={i} className="text-xs text-rose-700">• {e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {sitemapData.sampleUrls.length > 0 && (
                <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-4">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">Sample URLs</h4>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {sitemapData.sampleUrls.map((u, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600 py-1 px-2 bg-gray-50 rounded-lg">
                        <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="truncate">{u}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Meta Tag Audit ────────────────────────────────────────────────── */}
      {activePanel === "meta" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Meta Tag Audit</h3>
              <p className="text-xs text-gray-500 mt-0.5">Scan pages for missing/duplicate titles, descriptions, H1s</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchMetaAudit} disabled={metaLoading} className="gap-2 text-xs h-8">
              {metaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileSearch className="h-3.5 w-3.5" />}
              Run Audit
            </Button>
          </div>

          {metaData.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <FileSearch className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Run Audit" to scan your pages for meta tag issues</p>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <span className="text-xs text-gray-500">Pages Scanned</span>
                  <p className="text-xl font-bold text-gray-900">{metaData.length}</p>
                </div>
                <div className={cn("rounded-xl border p-4", issueCount === 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200")}>
                  <span className="text-xs text-gray-500">Total Issues</span>
                  <p className={cn("text-xl font-bold", issueCount === 0 ? "text-emerald-600" : "text-amber-600")}>{issueCount}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <span className="text-xs text-gray-500">Missing Titles</span>
                  <p className="text-xl font-bold text-gray-900">{metaData.filter(m => m.issues.includes("missing_title")).length}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <span className="text-xs text-gray-500">Missing Descriptions</span>
                  <p className="text-xl font-bold text-gray-900">{metaData.filter(m => m.issues.includes("missing_description")).length}</p>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">URL</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-600">Len</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Description</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-600">Len</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">H1</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {metaData.map((m, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-700 truncate max-w-[180px]">{truncateUrl(m.url, 40)}</td>
                          <td className="px-4 py-2.5 text-gray-600 truncate max-w-[200px]">{m.title || <span className="text-rose-400 italic">Missing</span>}</td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{m.titleLength}</td>
                          <td className="px-4 py-2.5 text-gray-600 truncate max-w-[200px]">{m.description || <span className="text-rose-400 italic">Missing</span>}</td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{m.descriptionLength}</td>
                          <td className="px-4 py-2.5 text-gray-600 truncate max-w-[150px]">{m.h1 || <span className="text-rose-400 italic">Missing</span>}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {m.issues.map((issue, j) => (
                                <span key={j} className="px-1.5 py-0.5 bg-rose-100 text-rose-600 rounded text-[10px] font-medium">
                                  {issue.replace(/_/g, " ")}
                                </span>
                              ))}
                              {m.issues.length === 0 && <span className="text-emerald-500 text-[10px]">✓ Clean</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Index Coverage ────────────────────────────────────────────────── */}
      {activePanel === "index" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Index Coverage</h3>
              <p className="text-xs text-gray-500 mt-0.5">Check which pages are indexed by Google</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => fetchIndexCoverage()} disabled={indexLoading} className="gap-2 text-xs h-8">
              {indexLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
              Check Coverage
            </Button>
          </div>

          {/* URL checker */}
          <div className="flex gap-2">
            <Input placeholder="Enter a URL to check…" value={indexCheckUrl} onChange={e => setIndexCheckUrl(e.target.value)}
              className="text-sm max-w-md" />
            <Button variant="outline" size="sm" disabled={!indexCheckUrl || indexLoading}
              onClick={() => { fetchIndexCoverage([indexCheckUrl]); setIndexCheckUrl(""); }}
              className="text-xs h-9 gap-1">
              <Shield className="h-3.5 w-3.5" /> Check
            </Button>
          </div>

          {!indexData ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Shield className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Check Coverage" to inspect your URLs via Google's URL Inspection API</p>
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
                  <span className="text-xs text-gray-500">Indexed</span>
                  <p className="text-2xl font-bold text-emerald-600">{indexData.indexed}</p>
                </div>
                <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                  <span className="text-xs text-gray-500">Excluded</span>
                  <p className="text-2xl font-bold text-amber-600">{indexData.excluded}</p>
                </div>
                <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
                  <span className="text-xs text-gray-500">Errors</span>
                  <p className="text-2xl font-bold text-rose-600">{indexData.error}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <span className="text-xs text-gray-500">Total Checked</span>
                  <p className="text-2xl font-bold text-gray-900">{indexData.total}</p>
                </div>
              </div>

              {/* Donut chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center justify-center">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie data={[
                        { name: "Indexed", value: indexData.indexed, fill: "#10b981" },
                        { name: "Excluded", value: indexData.excluded, fill: "#f59e0b" },
                        { name: "Error", value: indexData.error, fill: "#ef4444" },
                      ]} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                        {[
                          { fill: "#10b981" }, { fill: "#f59e0b" }, { fill: "#ef4444" },
                        ].map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <RechartsTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* URL list */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 max-h-[300px] overflow-y-auto">
                  <h4 className="text-sm font-bold text-gray-800 mb-3">URL Details</h4>
                  <div className="space-y-2">
                    {indexData.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2 py-2 px-3 rounded-lg bg-gray-50">
                        {item.status === "submitted_indexed"
                          ? <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          : item.status === "error"
                          ? <XCircle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                          : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs text-gray-700 truncate">{truncateUrl(item.url, 60)}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{item.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
