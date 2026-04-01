import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  User, Users, Shield, Pen, Info, Loader2, Save, Globe,
  Plus, X, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Client } from "@/hooks/useClientDashboard";

interface KnowledgeBaseProps {
  selectedClient: Client | null;
  isAdmin: boolean;
}

type KBPage = "profile" | "competitors" | "eeat" | "tone" | "context";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadKBData(clientId: string, table: string) {
  try {
    const { data } = await supabase.from(table as any).select("*").eq("client_id", clientId).maybeSingle();
    return data || null;
  } catch { return null; }
}

async function saveKBData(clientId: string, table: string, payload: Record<string, any>) {
  try {
    const { error } = await supabase.from(table as any).upsert(
      { client_id: clientId, ...payload, updated_at: new Date().toISOString() },
      { onConflict: "client_id" }
    );
    return !error;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Sub-page: Brand Profile
// ---------------------------------------------------------------------------

function ProfilePage({ client }: { client: Client }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const [location, setLocation] = useState("");
  const [reach, setReach] = useState("Nationwide");
  const [language, setLanguage] = useState("English");
  const [brandContext, setBrandContext] = useState("");

  useEffect(() => {
    loadKBData(client.id, "client_knowledge_base").then(d => {
      if (d) {
        setExactMatch(d.exact_match ?? false);
        setLocation(d.location ?? "");
        setReach(d.geographic_reach ?? "Nationwide");
        setLanguage(d.language ?? "English");
        setBrandContext(d.brand_context ?? "");
      }
      setLoading(false);
    });
  }, [client.id]);

  const save = async () => {
    setSaving(true);
    const ok = await saveKBData(client.id, "client_knowledge_base", {
      exact_match: exactMatch, location, geographic_reach: reach, language, brand_context: brandContext,
    });
    setSaving(false);
    if (ok) toast.success("Profile saved");
    else toast.error("Failed to save — table may not exist yet");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500 mt-0.5">Define your brand's identity, location, and positioning.</p>
      </div>

      {/* Brand name card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold">{client.brand_name.charAt(0)}</span>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">Brand Name</p>
            <p className="font-semibold text-gray-900">{client.brand_name}</p>
            {client.brand_domain && <p className="text-xs text-blue-600">{client.brand_domain}</p>}
          </div>
        </div>

        {/* Exact match toggle */}
        <div className="flex items-start justify-between pt-4 border-t border-gray-100">
          <div>
            <p className="text-sm font-medium text-gray-800">Exact match only</p>
            <p className="text-xs text-gray-500 mt-0.5">Only count mentions that match the exact spelling above</p>
          </div>
          <button
            onClick={() => setExactMatch(v => !v)}
            className={cn("relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5", exactMatch ? "bg-blue-600" : "bg-gray-200")}
          >
            <span className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", exactMatch ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </div>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700">Location</Label>
        <p className="text-xs text-gray-400">Where is your brand primarily based?</p>
        <Input placeholder="e.g. San Francisco, CA" value={location} onChange={e => setLocation(e.target.value)} className="bg-white border-gray-200" />
      </div>

      {/* Geographic reach */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700">Geographic Reach</Label>
        <p className="text-xs text-gray-400">What's your brand's area of influence?</p>
        <div className="flex flex-wrap gap-2">
          {["Worldwide", "Nationwide", "Regional", "State", "City"].map(r => (
            <button
              key={r}
              onClick={() => setReach(r)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium border transition-all",
                reach === r ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700">Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="bg-white border-gray-200 w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["English", "Spanish", "French", "German", "Portuguese", "Hindi", "Arabic", "Japanese", "Chinese", "Korean"].map(l => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Brand context */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-gray-700">Brand Context</Label>
          <span className="text-xs text-gray-400">{brandContext.length}/500</span>
        </div>
        <p className="text-xs text-gray-400">This context helps AI understand your brand voice and messaging</p>
        <Textarea
          value={brandContext}
          onChange={e => setBrandContext(e.target.value.slice(0, 500))}
          placeholder="Describe your brand, what you do, who you serve, and what makes you unique..."
          rows={5}
          className="bg-white border-gray-200 resize-none"
        />
      </div>

      <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Profile
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-page: Competitors
// ---------------------------------------------------------------------------

function CompetitorsPage({ client }: { client: Client }) {
  const competitors: string[] = client.competitors || [];
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Competitors</h2>
        <p className="text-sm text-gray-500 mt-0.5">Brands you compete against in AI search responses.</p>
      </div>
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700">Competitors are managed in Brand Settings. Changes sync automatically to Share of Voice tracking.</p>
      </div>
      {competitors.length > 0 ? (
        <div className="space-y-2">
          {competitors.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl">
              <img src={`https://www.google.com/s2/favicons?domain=${c.toLowerCase().replace(/\s+/g, '')}.com&sz=20`} alt="" className="h-5 w-5 rounded flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              <Globe className="h-5 w-5 text-gray-300 flex-shrink-0 -ml-8 hidden" />
              <span className="flex-1 text-sm font-medium text-gray-800">{c}</span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Managed in Settings</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <Users className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No competitors added yet</p>
          <p className="text-sm text-gray-400 mt-1">Add competitors in Brand Settings to enable SOV tracking.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-page: E-E-A-T
// ---------------------------------------------------------------------------

function EEATPage({ client }: { client: Client }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(client.brand_domain ? `https://${client.brand_domain}` : "");
  const [yearFounded, setYearFounded] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [kbOwner, setKbOwner] = useState("");
  const [editorInChief, setEditorInChief] = useState("");
  const [reviewFrequency, setReviewFrequency] = useState("Monthly");
  const [editorialPolicy, setEditorialPolicy] = useState("");

  useEffect(() => {
    loadKBData(client.id, "client_eeat").then(d => {
      if (d) {
        setOrgName(d.org_name ?? ""); setLegalName(d.legal_name ?? "");
        setWebsiteUrl(d.website_url ?? websiteUrl); setYearFounded(d.year_founded ?? "");
        setTwitterUrl(d.twitter_url ?? ""); setLogoUrl(d.logo_url ?? "");
        setKbOwner(d.kb_owner ?? ""); setEditorInChief(d.editor_in_chief ?? "");
        setReviewFrequency(d.review_frequency ?? "Monthly"); setEditorialPolicy(d.editorial_policy ?? "");
      }
      setLoading(false);
    });
  }, [client.id]);

  const save = async () => {
    setSaving(true);
    const ok = await saveKBData(client.id, "client_eeat", {
      org_name: orgName, legal_name: legalName, website_url: websiteUrl, year_founded: yearFounded,
      twitter_url: twitterUrl, logo_url: logoUrl, kb_owner: kbOwner, editor_in_chief: editorInChief,
      review_frequency: reviewFrequency, editorial_policy: editorialPolicy,
    });
    setSaving(false);
    if (ok) toast.success("E-E-A-T data saved");
    else toast.error("Failed to save — table may not exist yet");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">E-E-A-T</h2>
        <p className="text-sm text-gray-500 mt-0.5">Experience, Expertise, Authoritativeness, Trustworthiness. This data powers schema markup and helps AI models verify your credibility.</p>
      </div>

      {/* Entity & Ownership */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
          Entity & Ownership
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Organization name</Label>
            <Input placeholder="e.g. Acme Inc." value={orgName} onChange={e => setOrgName(e.target.value)} className="bg-white border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Legal entity name</Label>
            <Input placeholder="e.g. Acme Technologies Ltd." value={legalName} onChange={e => setLegalName(e.target.value)} className="bg-white border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Primary website URL</Label>
            <Input placeholder="https://..." value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} className="bg-white border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Year founded</Label>
            <Input placeholder="e.g. 2019" value={yearFounded} onChange={e => setYearFounded(e.target.value)} className="bg-white border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Twitter / X URL</Label>
            <Input placeholder="https://x.com/..." value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)} className="bg-white border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Logo URL</Label>
            <Input placeholder="https://yoursite.com/logo.png" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} className="bg-white border-gray-200" />
          </div>
        </div>
      </div>

      {/* Editorial Responsibility */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
          Editorial Responsibility
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Knowledge base owner</Label>
            <Input placeholder="Person or organization" value={kbOwner} onChange={e => setKbOwner(e.target.value)} className="bg-white border-gray-200" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-600">Editor-in-chief</Label>
            <Input placeholder="Name" value={editorInChief} onChange={e => setEditorInChief(e.target.value)} className="bg-white border-gray-200" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-600">Review frequency</Label>
          <Select value={reviewFrequency} onValueChange={setReviewFrequency}>
            <SelectTrigger className="bg-white border-gray-200 w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Continuous", "Monthly", "Quarterly", "Annually"].map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-600">Editorial policy</Label>
          <Textarea
            value={editorialPolicy}
            onChange={e => setEditorialPolicy(e.target.value)}
            placeholder="Describe your content review and editorial standards..."
            rows={3}
            className="bg-white border-gray-200 resize-none"
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save E-E-A-T Data
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-page: Tone / Writing Style
// ---------------------------------------------------------------------------

function TonePage({ client }: { client: Client }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState("Professional");
  const [styleNotes, setStyleNotes] = useState("");
  const [targetAudience, setTargetAudience] = useState("");

  useEffect(() => {
    loadKBData(client.id, "client_tone").then(d => {
      if (d) { setTone(d.tone ?? "Professional"); setStyleNotes(d.style_notes ?? ""); setTargetAudience(d.target_audience ?? ""); }
      setLoading(false);
    });
  }, [client.id]);

  const save = async () => {
    setSaving(true);
    const ok = await saveKBData(client.id, "client_tone", { tone, style_notes: styleNotes, target_audience: targetAudience });
    setSaving(false);
    if (ok) toast.success("Tone saved"); else toast.error("Failed to save");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;

  const tones = ["Professional", "Friendly", "Technical", "Conversational", "Authoritative"];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Tone / Writing Style</h2>
        <p className="text-sm text-gray-500 mt-0.5">Define how your brand communicates. Used for AI content generation.</p>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700">Tone</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {tones.map(t => (
            <button key={t} onClick={() => setTone(t)} className={cn(
              "px-4 py-3 rounded-xl text-sm font-medium border transition-all text-left",
              tone === t ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            )}>{t}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700">Target audience</Label>
        <Input placeholder="e.g. B2B SaaS founders, cricket enthusiasts aged 18-35..." value={targetAudience} onChange={e => setTargetAudience(e.target.value)} className="bg-white border-gray-200" />
      </div>
      <div className="space-y-2">
        <Label className="text-sm font-semibold text-gray-700">Writing style notes</Label>
        <Textarea value={styleNotes} onChange={e => setStyleNotes(e.target.value)} placeholder="Any specific style guidelines, phrases to avoid, preferred terminology..." rows={4} className="bg-white border-gray-200 resize-none" />
      </div>
      <Button onClick={save} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Tone
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main KnowledgeBase component
// ---------------------------------------------------------------------------

const NAV: { id: KBPage; label: string; icon: React.FC<any>; section: string }[] = [
  { id: "profile",     label: "Profile",           icon: User,   section: "Brand" },
  { id: "competitors", label: "Competitors",        icon: Users,  section: "Brand" },
  { id: "eeat",        label: "E-E-A-T",            icon: Shield, section: "Brand" },
  { id: "tone",        label: "Tone / Writing Style", icon: Pen, section: "Writing" },
];

export function KnowledgeBase({ selectedClient }: KnowledgeBaseProps) {
  const [page, setPage] = useState<KBPage>("profile");

  if (!selectedClient) {
    return (
      <div className="flex items-center justify-center py-24 text-center">
        <div>
          <Globe className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">Select a brand to manage its Knowledge Base.</p>
        </div>
      </div>
    );
  }

  const sections = Array.from(new Set(NAV.map(n => n.section)));

  return (
    <div className="flex gap-6">
      {/* Left sub-nav */}
      <div className="w-48 flex-shrink-0">
        <div className="bg-white border border-gray-200 rounded-xl p-3 sticky top-0">
          {sections.map(section => (
            <div key={section} className="mb-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-2 mb-1">{section}</p>
              {NAV.filter(n => n.section === section).map(item => (
                <button
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left mb-0.5",
                    page === item.id ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  )}
                >
                  <item.icon className={cn("h-4 w-4 flex-shrink-0", page === item.id ? "text-white" : "text-gray-400")} />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Right content area */}
      <div className="flex-1 min-w-0">
        {page === "profile"     && <ProfilePage client={selectedClient} />}
        {page === "competitors" && <CompetitorsPage client={selectedClient} />}
        {page === "eeat"        && <EEATPage client={selectedClient} />}
        {page === "tone"        && <TonePage client={selectedClient} />}
      </div>
    </div>
  );
}
