import React, { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Loader2,
  Copy,
  Download,
  Settings,
  Building2,
  Wand2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Clock,
  FileText,
  BookOpen,
  Video,
  Mail,
  MessageSquare,
  Globe,
  Upload,
  X,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

export interface GeneratedContentHistoryItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  source: "content_tab" | "prompt_detail";
  promptText?: string;
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
  onGenerateContent: (documentContext?: string) => void;
  prompts: Prompt[];
  industries: Record<string, { competitors: string[]; prompts: string[]; nichePrompts: string[]; superNichePrompts: string[] }>;
  setEditClientForm: React.Dispatch<React.SetStateAction<EditClientFormData>>;
  setEditClientOpen: (open: boolean) => void;
  // History storage
  generatedContentHistory: GeneratedContentHistoryItem[];
  onDeleteHistoryItem: (id: string) => void;
  // Access control
  isAdmin: boolean;
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
  generatedContentHistory,
  onDeleteHistoryItem,
  isAdmin,
}: ContentTabProps) {
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [uploadedDocText, setUploadedDocText] = useState<string>("");
  const [uploadedDocName, setUploadedDocName] = useState<string>("");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setDocError("");
    setUploadingDoc(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "txt" || ext === "md") {
        const text = await file.text();
        setUploadedDocText(text);
        setUploadedDocName(file.name);
      } else if (ext === "pdf") {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
        }
        setUploadedDocText(fullText);
        setUploadedDocName(file.name);
      } else if (ext === "docx") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setUploadedDocText(result.value);
        setUploadedDocName(file.name);
      } else {
        setDocError("Unsupported file type. Please upload a .txt, .md, .pdf, or .docx file.");
      }
    } catch (err) {
      setDocError("Failed to read file. Please try again.");
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-gray-900">Content Generator</h2><p className="text-sm text-gray-500">Generate SEO-optimized content based on your brand and audit insights</p></div></div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4"><div><Label>Topic / Title</Label><Input placeholder="e.g., Best dating apps for professionals in 2025" value={contentTopic} onChange={(e) => setContentTopic(e.target.value)} className="mt-1" /></div><div><Label>Content Type</Label><Select value={contentType} onValueChange={setContentType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Written Content</div>
              <SelectItem value="article">📝 Article</SelectItem>
              <SelectItem value="listicle">📋 Listicle (Top 10)</SelectItem>
              <SelectItem value="comparison">⚖️ Comparison Guide</SelectItem>
              <SelectItem value="guide">🗺️ How-To Guide</SelectItem>
              <SelectItem value="faq">❓ FAQ Section</SelectItem>
              <SelectItem value="press_release">📰 Press Release</SelectItem>
              <SelectItem value="product_description">🛍️ Product Description</SelectItem>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Video</div>
              <SelectItem value="video_script">🎬 Video Script (YouTube / CTV)</SelectItem>
              <SelectItem value="youtube_description">▶️ YouTube Description</SelectItem>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Social & Email</div>
              <SelectItem value="linkedin_post">💼 LinkedIn Post</SelectItem>
              <SelectItem value="twitter_thread">🐦 Twitter/X Thread</SelectItem>
              <SelectItem value="email_newsletter">📧 Email Newsletter</SelectItem>
              <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-1">Conversion</div>
              <SelectItem value="landing_page">🚀 Landing Page Copy</SelectItem>
            </SelectContent></Select></div></div>
            <div className="grid grid-cols-2 gap-4"><div><Label>Target Audience</Label><Input placeholder="e.g., Millennials, CTOs, Stay-at-home parents" value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="mt-1" /></div><div><Label>Keywords / Key Selling Points</Label><Input placeholder="e.g., affordable, AI-powered, 24/7 support" value={contentKeywords} onChange={(e) => setContentKeywords(e.target.value)} className="mt-1" /></div></div>
            <div><Label>Tone of Voice Reference</Label><Textarea placeholder="Paste a sample press release or product description here. The AI will analyze and mimic its style." value={toneOfVoice} onChange={(e) => setToneOfVoice(e.target.value)} className="mt-1 h-24" /></div>

            {/* File upload for brand/reference docs */}
            <div>
              <Label>Brand / Reference Document <span className="text-gray-400 font-normal">(optional)</span></Label>
              <p className="text-xs text-gray-500 mt-0.5 mb-2">Upload a PDF, DOCX, or TXT with brand guidelines, tone samples, product specs, etc. The AI will use it as extra context.</p>
              {!uploadedDocName ? (
                <div
                  className={`relative border-2 border-dashed rounded-lg p-4 transition-colors cursor-pointer hover:border-gray-400 hover:bg-gray-50 ${uploadingDoc ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f); }}
                >
                  <input ref={fileInputRef} type="file" accept=".txt,.md,.pdf,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ""; }} />
                  <div className="flex flex-col items-center gap-1.5 py-1">
                    {uploadingDoc ? (
                      <><Loader2 className="h-6 w-6 text-blue-400 animate-spin" /><p className="text-sm text-blue-600">Reading document...</p></>
                    ) : (
                      <><FileUp className="h-6 w-6 text-gray-400" /><p className="text-sm text-gray-600"><span className="font-medium text-gray-800">Click to upload</span> or drag & drop</p><p className="text-xs text-gray-400">PDF, DOCX, TXT, MD — up to 5MB</p></>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="p-1.5 bg-green-100 rounded"><FileText className="h-4 w-4 text-green-600" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-green-800 truncate">{uploadedDocName}</p>
                    <p className="text-xs text-green-600">{uploadedDocText.length.toLocaleString()} characters extracted · will be included in generation</p>
                  </div>
                  <button onClick={() => { setUploadedDocText(""); setUploadedDocName(""); setDocError(""); }} className="p-1 rounded hover:bg-green-200 transition-colors flex-shrink-0"><X className="h-4 w-4 text-green-700" /></button>
                </div>
              )}
              {docError && <p className="text-xs text-red-500 mt-1.5">{docError}</p>}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg"><div className="flex items-center justify-between mb-3"><Label className="text-sm font-medium">Content will include:</Label><Button variant="outline" size="sm" onClick={() => { const clientIndustry = Object.keys(industries).includes(selectedClient?.industry || "") ? selectedClient?.industry : "Custom"; const customInd = Object.keys(industries).includes(selectedClient?.industry || "") ? "" : selectedClient?.industry || ""; setEditClientForm({ name: selectedClient?.name || "", brand_name: selectedClient?.brand_name || "", target_region: selectedClient?.target_region || "", industry: clientIndustry || "Custom", customIndustry: customInd, primary_color: selectedClient?.primary_color || "#3b82f6", logo_url: "", competitors: selectedClient?.competitors?.join(", ") || "", website: selectedClient?.brand_domain || "" }); setEditClientOpen(true); }} className="text-xs"><Settings className="h-3 w-3 mr-1" />Edit</Button></div><div className="flex flex-wrap gap-2">{selectedClient?.brand_name && <span className="inline-flex items-center px-3 py-1.5 bg-blue-100 border border-blue-300 rounded-lg text-sm text-blue-800 font-medium">Brand: {selectedClient.brand_name}</span>}{selectedClient?.target_region && <span className="inline-flex items-center px-3 py-1.5 bg-green-100 border border-green-300 rounded-lg text-sm text-green-800 font-medium">Region: {selectedClient.target_region}</span>}{selectedClient?.industry && <span className="inline-flex items-center px-3 py-1.5 bg-purple-100 border border-purple-300 rounded-lg text-sm text-purple-800 font-medium">Industry: {selectedClient.industry}</span>}{selectedClient?.competitors?.slice(0, 3).map((c, i) => <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-800 font-medium"><Building2 className="h-3.5 w-3.5" />{c}</span>)}</div></div>
            <Button onClick={() => onGenerateContent(uploadedDocText || undefined)} disabled={generatingContent || !contentTopic.trim()} className="w-full bg-gray-900 hover:bg-gray-800">{generatingContent ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating...</> : <><Wand2 className="h-4 w-4 mr-2" />{uploadedDocText ? "Generate with Document" : "Generate Content"}</>}</Button>
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
            }}>{generatedContent}</ReactMarkdown></div>
              {/* AI Disclaimer */}
              <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                <svg className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-semibold">Important Notice:</span> This content is AI-generated and engineered for high-intent visibility across Large Language Models. While optimized for brand tone and relevance, all outputs must be reviewed, fact-checked, and verified by a human editor or professional writer prior to publishing to ensure absolute accuracy and compliance with brand standards.
                </p>
              </div>
            </div>)}
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Quick Topics</h3><p className="text-xs text-gray-500 mb-3">Based on your prompts and audit results</p><div className="space-y-2">{prompts.slice(0, 5).map((p, i) => (<button key={i} onClick={() => setContentTopic(p.prompt_text)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg truncate">{p.prompt_text}</button>))}{prompts.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Add prompts to see suggestions</p>}</div></div>
          {/* Content type-aware idea suggestions */}
          {['video_script', 'youtube_description'].includes(contentType) ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3"><Video className="h-4 w-4 text-red-500" /><h3 className="font-semibold text-gray-900">Video Ideas</h3></div>
              <div className="space-y-2">{[
                `How ${selectedClient?.brand_name} helps ${selectedClient?.industry} businesses`,
                `${selectedClient?.brand_name} vs ${selectedClient?.competitors?.[0] || "the competition"}: which wins?`,
                `Step-by-step: Getting started with ${selectedClient?.brand_name}`,
                `Top 5 mistakes in ${selectedClient?.industry} (and how to fix them)`,
              ].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div>
            </div>
          ) : ['linkedin_post', 'twitter_thread'].includes(contentType) ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4 text-blue-500" /><h3 className="font-semibold text-gray-900">Social Ideas</h3></div>
              <div className="space-y-2">{[
                `Unpopular opinion: most ${selectedClient?.industry} tools are overpriced`,
                `What I learned after testing ${selectedClient?.competitors?.slice(0, 2).join(' and ') || 'top tools'} vs ${selectedClient?.brand_name}`,
                `The one ${selectedClient?.industry} metric nobody talks about`,
                `How we cut costs with ${selectedClient?.brand_name}`,
              ].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div>
            </div>
          ) : contentType === 'email_newsletter' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3"><Mail className="h-4 w-4 text-emerald-500" /><h3 className="font-semibold text-gray-900">Email Ideas</h3></div>
              <div className="space-y-2">{[
                `Welcome to ${selectedClient?.brand_name} — here's what to do first`,
                `5 ways ${selectedClient?.brand_name} users are winning in ${selectedClient?.industry}`,
                `This week in ${selectedClient?.industry}: trends + how we respond`,
                `Your monthly ${selectedClient?.industry} roundup from ${selectedClient?.brand_name}`,
              ].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div>
            </div>
          ) : contentType === 'landing_page' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3"><Globe className="h-4 w-4 text-purple-500" /><h3 className="font-semibold text-gray-900">Page Ideas</h3></div>
              <div className="space-y-2">{[
                `${selectedClient?.brand_name} vs ${selectedClient?.competitors?.[0] || 'alternatives'} comparison page`,
                `${selectedClient?.brand_name} for ${selectedClient?.industry} businesses`,
                `${selectedClient?.brand_name} pricing and plans`,
                `Get started with ${selectedClient?.brand_name} free trial`,
              ].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Content Ideas</h3><div className="space-y-2">{[`Why ${selectedClient?.brand_name} is the best choice in ${selectedClient?.target_region}`, `${selectedClient?.brand_name} vs ${selectedClient?.competitors?.[0] || "Competitors"}: Complete Comparison`, `Top 10 reasons to choose ${selectedClient?.brand_name}`, `How ${selectedClient?.brand_name} solves common ${selectedClient?.industry} problems`].map((idea, i) => (<button key={i} onClick={() => setContentTopic(idea)} className="w-full text-left p-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">{idea}</button>))}</div></div>
          )}
          <div className="bg-blue-50 rounded-xl border border-blue-200 p-5"><h3 className="font-semibold text-blue-900 mb-2">Pro Tip</h3><p className="text-sm text-blue-700">Generate content for topics where your brand has low visibility to improve your AI search presence.</p></div>
        </div>
      </div>

      {/* Generated Content Library */}
      {generatedContentHistory.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-gray-500" />
              <h3 className="font-semibold text-gray-900">Generated Content Library</h3>
              <Badge variant="secondary" className="text-xs">{generatedContentHistory.length}</Badge>
            </div>
            <p className="text-xs text-gray-400">All previously generated articles, stored locally</p>
          </div>
          <div className="divide-y divide-gray-50">
            {generatedContentHistory.map((item) => (
              <div key={item.id} className="group">
                <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50/60 transition-colors">
                  <div className="p-2 bg-purple-50 rounded-lg flex-shrink-0">
                    <FileText className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-gray-900 text-sm truncate">{item.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-4 flex-shrink-0 ${item.source === "prompt_detail"
                          ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                      >
                        {item.source === "prompt_detail" ? "Prompt Article" : "Content Tab"}
                      </Badge>
                    </div>
                    {item.promptText && (
                      <p className="text-xs text-gray-400 truncate">Prompt: {item.promptText}</p>
                    )}
                    <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400">
                      <Clock className="h-3 w-3" />
                      {new Date(item.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => navigator.clipboard.writeText(item.content)}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1" />Copy
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDeleteHistoryItem(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                    >
                      {expandedHistoryId === item.id ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
                {expandedHistoryId === item.id && (
                  <div className="px-6 pb-6 bg-gray-50/40">
                    <div className="max-w-none p-5 bg-white rounded-lg border border-gray-200 max-h-[500px] overflow-y-auto shadow-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ node, ...props }) => <p className="mb-3 text-gray-700 leading-relaxed text-sm" {...props} />,
                          h1: ({ node, ...props }) => <h1 className="text-xl font-bold mt-6 mb-3 text-gray-900 border-b border-gray-100 pb-2" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="text-lg font-bold mt-5 mb-2 text-gray-900" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="text-base font-semibold mt-4 mb-2 text-gray-800" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1.5 text-sm" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5 text-sm" {...props} />,
                          li: ({ node, ...props }) => <li className="text-gray-700" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-semibold text-gray-900" {...props} />,
                          hr: ({ node, ...props }) => <hr className="my-4 border-gray-200" {...props} />,
                        }}
                      >
                        {item.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
