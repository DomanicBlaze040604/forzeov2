import { useState, useCallback, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  Link, Shield, AlertTriangle, Loader2, RefreshCw, ExternalLink,
  Download, ChevronDown, ChevronUp, Globe, CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callSEOFunction, fmtNum } from "./helpers";
import type { BacklinkProfile, BacklinkItem, ToxicLinkItem } from "./types";

interface BacklinkModuleProps {
  clientId: string;
  siteUrl: string | null;
}

export default function BacklinkModule({ clientId, siteUrl }: BacklinkModuleProps) {
  const [activePanel, setActivePanel] = useState<"profile" | "list" | "toxic">("profile");

  // State
  const [profile, setProfile] = useState<BacklinkProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [backlinks, setBacklinks] = useState<BacklinkItem[]>([]);
  const [backlinksTotal, setBacklinksTotal] = useState(0);
  const [backlinksLoading, setBacklinksLoading] = useState(false);
  const [toxicLinks, setToxicLinks] = useState<ToxicLinkItem[]>([]);
  const [toxicLoading, setToxicLoading] = useState(false);
  const [expandedToxic, setExpandedToxic] = useState<string | null>(null);

  // ── Auto-load Cache ─────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!clientId) return;
    const loadCache = async () => {
      try {
        const res = await callSEOFunction("seo-tools", "get_all_audits", clientId, {});
        const audits = res.audits || [];
        
        const cachedProfile = audits.find((a: any) => a.audit_type === "backlink_profile");
        if (cachedProfile) setProfile(cachedProfile.data);
      } catch (err) {
        console.error("Failed to load backlink cache:", err);
      }
    };
    loadCache();
  }, [clientId]);

  // ── Fetchers ────────────────────────────────────────────────────────────

  const fetchProfile = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setProfileLoading(true);
    try {
      const data = await callSEOFunction("seo-backlinks", "backlink_profile", clientId, { target_domain: siteUrl });
      setProfile(data);
      toast.success("Backlink profile loaded");
    } catch (err: any) {
      toast.error("Profile fetch failed: " + err.message);
    } finally {
      setProfileLoading(false);
    }
  }, [clientId, siteUrl]);

  const fetchBacklinks = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setBacklinksLoading(true);
    try {
      const data = await callSEOFunction("seo-backlinks", "backlink_list", clientId, { target_domain: siteUrl });
      setBacklinks(data.backlinks || []);
      setBacklinksTotal(data.total || 0);
      toast.success(`Loaded ${data.backlinks?.length || 0} backlinks`);
    } catch (err: any) {
      toast.error("Backlinks fetch failed: " + err.message);
    } finally {
      setBacklinksLoading(false);
    }
  }, [clientId, siteUrl]);

  const fetchToxic = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    setToxicLoading(true);
    try {
      const data = await callSEOFunction("seo-backlinks", "toxic_check", clientId, { target_domain: siteUrl });
      setToxicLinks(data.toxicDomains || []);
      toast.success(`Found ${data.total || 0} potentially toxic domains`);
    } catch (err: any) {
      toast.error("Toxic check failed: " + err.message);
    } finally {
      setToxicLoading(false);
    }
  }, [clientId, siteUrl]);

  const exportDisavow = useCallback(() => {
    if (toxicLinks.length === 0) return;
    const content = toxicLinks
      .filter(t => t.toxicScore >= 50)
      .map(t => `domain:${t.domain}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "disavow.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Disavow file downloaded");
  }, [toxicLinks]);

  const authPieData = profile?.authorityDistribution
    .filter(d => d.count > 0)
    .map(d => ({ name: d.range, value: d.count })) || [];

  const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6"];

  const panels = [
    { id: "profile", label: "Profile", icon: Globe },
    { id: "list", label: "Backlinks", icon: Link },
    { id: "toxic", label: "Toxic Links", icon: Shield },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit flex-wrap">
        {panels.map(p => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activePanel === p.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700")}>
            <p.icon className="h-3.5 w-3.5" />{p.label}
            {p.id === "toxic" && toxicLinks.length > 0 && (
              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{toxicLinks.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Profile ──────────────────────────────────────────────────────── */}
      {activePanel === "profile" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Backlink Profile</h3>
              <p className="text-xs text-gray-500 mt-0.5">Overview of your site's backlink health</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchProfile} disabled={profileLoading} className="gap-2 text-xs h-8">
              {profileLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Fetch Profile
            </Button>
          </div>

          {!profile ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Globe className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Fetch Profile" to analyze your backlink profile</p>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Backlinks</span>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{fmtNum(profile.totalBacklinks)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Referring Domains</span>
                  <p className="text-2xl font-bold text-blue-600 mt-1">{fmtNum(profile.referringDomains)}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Domain Authority</span>
                  <p className="text-2xl font-bold text-purple-600 mt-1">{profile.domainAuthority}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Follow / Nofollow</span>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    <span className="text-emerald-600">{fmtNum(profile.followLinks)}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-gray-500">{fmtNum(profile.nofollowLinks)}</span>
                  </p>
                </div>
              </div>

              {/* Charts row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Authority Distribution */}
                {authPieData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 mb-3">Authority Distribution</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={profile.authorityDistribution} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="range" tick={{ fontSize: 9, fill: "#94a3b8" }} />
                        <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} />
                        <RechartsTooltip />
                        <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                          {profile.authorityDistribution.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top Anchors */}
                {profile.topAnchors.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h4 className="text-xs font-semibold text-gray-600 mb-3">Top Anchor Texts</h4>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {profile.topAnchors.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5">
                          <span className="text-xs text-gray-700 truncate max-w-[200px]">"{a.anchor}"</span>
                          <span className="text-xs font-bold text-gray-600 tabular-nums">{fmtNum(a.count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Backlink List ────────────────────────────────────────────────── */}
      {activePanel === "list" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Backlink List</h3>
              <p className="text-xs text-gray-500 mt-0.5">{backlinksTotal > 0 ? `${fmtNum(backlinksTotal)} total backlinks` : "All backlinks pointing to your site"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchBacklinks} disabled={backlinksLoading} className="gap-2 text-xs h-8">
              {backlinksLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Fetch Backlinks
            </Button>
          </div>

          {backlinks.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Link className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Fetch Backlinks" to see all links pointing to your site</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">Source</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600">Anchor</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-600">DR</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-600">Type</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-600">Target</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {backlinks.map((bl, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <ExternalLink className="h-3 w-3 text-gray-400 flex-shrink-0" />
                            <span className="text-gray-700 truncate max-w-[200px]">{bl.sourceDomain}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-gray-600 truncate max-w-[150px]">
                          {bl.anchorText || <span className="text-gray-400 italic">empty</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={cn("font-bold tabular-nums",
                            bl.domainRating >= 50 ? "text-emerald-600" : bl.domainRating >= 20 ? "text-amber-600" : "text-rose-600")}>
                            {bl.domainRating}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full",
                            bl.isFollow ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600")}>
                            {bl.isFollow ? "follow" : "nofollow"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-500 truncate max-w-[150px]">{bl.targetUrl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Toxic Links ──────────────────────────────────────────────────── */}
      {activePanel === "toxic" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Toxic Link Detection</h3>
              <p className="text-xs text-gray-500 mt-0.5">Identify spammy backlinks that could hurt rankings</p>
            </div>
            <div className="flex gap-2">
              {toxicLinks.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportDisavow} className="gap-2 text-xs h-8">
                  <Download className="h-3.5 w-3.5" /> Export Disavow
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={fetchToxic} disabled={toxicLoading} className="gap-2 text-xs h-8">
                {toxicLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                Check Toxic
              </Button>
            </div>
          </div>

          {toxicLinks.length === 0 && !toxicLoading ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-10 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-emerald-800">
                {toxicLoading ? "Scanning..." : "No toxic links detected — or click Check Toxic to scan"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {toxicLinks.map((t, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <button onClick={() => setExpandedToxic(expandedToxic === t.domain ? null : t.domain)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold",
                        t.toxicScore >= 70 ? "bg-rose-100 text-rose-700"
                        : t.toxicScore >= 50 ? "bg-amber-100 text-amber-700"
                        : "bg-orange-100 text-orange-700")}>
                        {t.toxicScore}
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-gray-800">{t.domain}</p>
                        <p className="text-xs text-gray-500">DR: {t.domainRating} · {t.backlinks} links · {t.isFollow ? "follow" : "nofollow"}</p>
                      </div>
                    </div>
                    {expandedToxic === t.domain ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </button>
                  {expandedToxic === t.domain && (
                    <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                      <h4 className="text-xs font-semibold text-gray-600 mb-2">Risk Factors:</h4>
                      <ul className="space-y-1">
                        {t.reasons.map((r, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-gray-600">
                            <AlertTriangle className="h-3 w-3 text-rose-500 mt-0.5 flex-shrink-0" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
