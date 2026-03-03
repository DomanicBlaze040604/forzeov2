import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  Copy,
  Download,
  Settings,
  Building2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Client, Prompt } from "@/hooks/useClientDashboard";

export interface EditClientFormData {
  name: string;
  brand_name: string;
  target_region: string;
  industry: string;
  customIndustry: string;
  primary_color: string;
  logo_url: string;
  competitors: string;
  website: string;
}

export interface ContentTabProps {
  contentTopic: string;
  setContentTopic: (value: string) => void;
  contentType: string;
  setContentType: (value: string) => void;
  targetAudience: string;
  setTargetAudience: (value: string) => void;
  contentKeywords: string;
  setContentKeywords: (value: string) => void;
  toneOfVoice: string;
  setToneOfVoice: (value: string) => void;
  generatingContent: boolean;
  generatedContent: string;
  selectedClient: Client | null;
  onGenerateContent: () => void;
  prompts: Prompt[];
  industries: Record<string, { competitors: string[]; prompts: string[]; nichePrompts: string[]; superNichePrompts: string[] }>;
  setEditClientForm: React.Dispatch<React.SetStateAction<EditClientFormData>>;
  setEditClientOpen: (open: boolean) => void;
}

export function ContentTab({
  contentTopic,
  setContentTopic,
  contentType,
  setContentType,
  targetAudience,
  setTargetAudience,
  contentKeywords,
  setContentKeywords,
  toneOfVoice,
  setToneOfVoice,
  generatingContent,
  generatedContent,
  selectedClient,
  onGenerateContent,
  prompts,
  industries,
  setEditClientForm,
  setEditClientOpen,
}: ContentTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Content Generator</h2><p className="text-sm text-gray-500">Generate SEO-optimized content based on your brand and audit insights</p></div></div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><div><Label>Topic / Title</Label><Input placeholder="e.g., Best dating apps for professionals in 2025" value={contentTopic} onChange={(e) => setContentTopic(e.target.value)} className="mt-1" /></div><div><Label>Content Type</Label><Select value={contentType} onValueChange={setContentType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="article">Article</SelectItem><SelectItem value="listicle">Listicle (Top 10)</SelectItem><SelectItem value="comparison">Comparison Guide</SelectItem><SelectItem value="guide">How-To Guide</SelectItem><SelectItem value="faq">FAQ Section</SelectItem><SelectItem value="press_release">Press Release</SelectItem><SelectItem value="product_description">Product Description</SelectItem></SelectContent></Select></div></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Target Audience</Label><Input placeholder="e.g., Millennials, CTOs, Stay-at-home parents" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="mt-1" /></div><div><Label>Keywords / Key Selling Points</Label><Input placeholder="e.g., affordable, AI-powered, 24/7 support" value={contentKeywords} onChange={(e) => setContentKeywords(e.target.value)} className="mt-1" /></div></div>
            <div><Label>Tone of Voice Reference</Label><Textarea placeholder="Paste a sample press release or product description here. The AI will analyze and mimic its style." value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} className="mt-1 h-24" /></div>
            <div className="p-4 bg-gray-50 rounded-lg"><div className="flex items-center justify-between mb-3"><Label className="text-sm font-medium">Content will include:</Label><Button variant="outline" size="sm" onClick={() => { const clientIndustry = Object.keys(industries).includes(selectedClient?.industry || "") ? selectedClient?.industry : "Custom"; const customInd = Object.keys(industries).includes(selectedClient?.industry || "") ? "" : selectedClient?.industry || ""; setEditClientForm({ name: selectedClient?.name || "", brand_name: selectedClient?.brand_name || "", target_region: selectedClient?.target_region || "", industry: clientIndustry || "Custom", customIndustry: customInd, primary_color: selectedClient?.primary_color || "#3b82f6", logo_url: "", competitors: selectedClient?.competitors?.join(", ") || "", website: selectedClient?.brand_domain || "" }); setEditClientOpen(true); }} className="text-xs"><Settings className="h-3 w-3 mr-1" />Edit</Button></div><div className="flex flex-wrap gap-2">{selectedClient?.brand_name && <span className="inline-flex items-center px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-800 font-medium">Brand: {selectedClient.brand_name}</span>}{selectedClient?.target_region && <span className="inline-flex items-center px-3 py-1.5 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800 font-medium">Region: {selectedClient.target_region}</span>}{selectedClient?.industry && <span className="inline-flex items-center px-3 py-1.5 bg-purple-100 border border-purple-300 rounded-lg text-sm text-purple-800 font-medium">Industry: {selectedClient.industry}</span>}{selectedClient?.competitors?.slice(0, 3).map((c, i) => <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium"><Building2 className="h-3.5 w-3.5" />{c}</span>)}</div></div>
            <Button onClick={onGenerateContent} disabled={generatingContent || !contentTopic.trim()} className="w-full bg-gray-900 hover:bg-gray-800">{generatingContent ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : "Generate Content"}</Button>
            {generatedContent && (<div className="mt-6"><div className="flex items-center justify-between mb-3"><Label className="text-sm font-medium">Generated Content</Label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(generatedContent)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button><Button variant="outline" size="sm" onClick={() => { const blob = new Blob([generatedContent], { type: "text/markdown" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${contentTopic.replace(/\s+/g, "-").toLowerCase()}-content.md`; a.click(); URL.revokeObjectURL(url); }}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button></div></div><div className="max-w-none p-6 bg-white rounded-lg border max-h-[600px] overflow-y-auto"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        p: ({ node, ...props }) => <p className="mb-4 text-gray-700 leading-relaxed text-[15px] max-w-3xl" {...props} />,
                        a: ({ node, ...props }) => <a className="text-blue-600 hover:text-blue-700 hover:underline font-medium transition-colors" target="_blank" rel="noopener noreferrer" {...props} />,
                        ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-5 space-y-2.5 text-[15px] max-w-3xl" {...props} />,
                        ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-5 space-y-2.5 text-[15px] max-w-3xl" {...props} />,
                        li: ({ node, ...props }) => <li className="pl-1 text-gray-700 marker:text-gray-400" {...props} />,
                        h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mt-8 mb-4 text-gray-900 tracking-tight border-b border-gray-200 pb-3" {...props} />,
                        h2: ({ node, ...props }) => <h2 className="text-xl font-bold mt-7 mb-3 text-gray-900 tracking-tight" {...props} />,
                        h3: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-6 mb-2 text-gray-800 tracking-tight" {...props} />,
                        h4: ({ node, ...props }) => <h4 className="text-base font-semibold mt-5 mb-2 text-gray-800" {...props} />,
                        blockquote: ({ node, ...props }) => <blockquote className="border-l-4 border-blue-300 pl-4 py-1 my-4 bg-blue-50/50 rounded-r-lg text-gray-700 italic" {...props} />,
                        code: ({ node, ...props }) => <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[13px] font-mono text-slate-800 border border-slate-200" {...props} />,
                        strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                        hr: ({ node, ...props }) => <hr className="my-6 border-gray-200" {...props} />,
                        table: ({ node, ...props }) => <div className="overflow-x-auto my-4"><table className="min-w-full border border-gray-200 rounded-lg text-sm" {...props} /></div>,
                        th: ({ node, ...props }) => <th className="px-4 py-2 bg-gray-50 text-left font-semibold text-gray-700 border-b border-gray-200" {...props} />,
                        td: ({ node, ...props }) => <td className="px-4 py-2 border-b border-gray-100 text-gray-700" {...props} />,
                      }}>{generatedContent}</ReactMarkdown></div></div>)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Quick Topics</h3><p className="text-xs text-gray-500 mb-3">Based on your prompts and audit results</p><div className="space-y-2">{prompts.slice(0, 5).map((p, i) => (<button key={i} onClick={() => setContentTopic(p.prompt_text)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg truncate">{p.prompt_text}</button>))}{prompts.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Add prompts to see suggestions</p>}</div></div>
          <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Content Ideas</h3><div className="space-y-2">{[`Why ${selectedClient?.brand_name} is the best choice in ${selectedClient?.target_region}`, `${selectedClient?.brand_name} vs ${selectedClient?.competitors[0] || "Competitors"}: Complete Comparison`, `Top 10 reasons to choose ${selectedClient?.brand_name}`, `How ${selectedClient?.brand_name} solves common ${selectedClient?.industry} problems`].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div></div>
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5"><h3 className="font-semibold text-blue-900 mb-2">Pro Tip</h3><p className="text-sm text-blue-700">Generate content for topics where your brand has low visibility to improve your AI search presence.</p></div>
        </div>
      </div>
    </div>
  );
}
