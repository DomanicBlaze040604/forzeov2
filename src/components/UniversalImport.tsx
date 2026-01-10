/**
 * ============================================================================
 * UNIVERSAL IMPORT COMPONENT
 * ============================================================================
 * 
 * Allows users to import data from competitor tools:
 * - Prompts & keywords
 * - Citations & sources
 * - Audit results & history
 * - Brand tags & competitors
 * 
 * Supports multiple import formats:
 * - JSON (full data export)
 * - CSV (prompts, citations)
 * - TXT (line-by-line prompts)
 * 
 * @version 1.0.0
 */

import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
    Upload, FileText, CheckCircle, AlertTriangle,
    Loader2, Database, FileJson, FileSpreadsheet, X, ArrowRight,
    Sparkles, Link2, MessageSquare, Building2
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface ImportedPrompt {
    text: string;
    category?: string;
    niche_level?: string;
}

interface ImportedCitation {
    url: string;
    title?: string;
    domain?: string;
    model?: string;
}

interface ImportedAuditResult {
    prompt_text: string;
    model_results?: Array<{
        model: string;
        response: string;
        brand_mentioned?: boolean;
        citations?: ImportedCitation[];
    }>;
    created_at?: string;
    share_of_voice?: number;
    average_rank?: number;
}

interface ImportData {
    prompts?: ImportedPrompt[];
    citations?: ImportedCitation[];
    audit_results?: ImportedAuditResult[];
    brand_tags?: string[];
    competitors?: string[];
    metadata?: {
        source?: string;
        exported_at?: string;
        version?: string;
    };
}

interface UniversalImportProps {
    clientId: string;
    onImportComplete?: () => void;
}

// ============================================
// COMPETITOR FORMAT PARSERS
// ============================================

function parseJSONImport(content: string): ImportData {
    const data = JSON.parse(content);

    // Handle different competitor export formats
    const result: ImportData = {
        prompts: [],
        citations: [],
        audit_results: [],
        brand_tags: [],
        competitors: [],
    };

    // Our own format
    if (data.prompts) {
        result.prompts = data.prompts.map((p: { text?: string; prompt_text?: string; query?: string; category?: string; niche_level?: string }) => ({
            text: p.text || p.prompt_text || p.query || String(p),
            category: p.category,
            niche_level: p.niche_level || "medium",
        }));
    }

    // Handle alternative prompt formats
    if (data.keywords && Array.isArray(data.keywords)) {
        result.prompts = [...(result.prompts || []), ...data.keywords.map((k: string | { keyword?: string; text?: string }) => ({
            text: typeof k === "string" ? k : k.keyword || k.text || "",
            niche_level: "medium",
        }))];
    }

    if (data.queries && Array.isArray(data.queries)) {
        result.prompts = [...(result.prompts || []), ...data.queries.map((q: string | { query?: string; text?: string }) => ({
            text: typeof q === "string" ? q : q.query || q.text || "",
            niche_level: "medium",
        }))];
    }

    // Citations
    if (data.citations) {
        result.citations = data.citations.map((c: { url: string; title?: string; domain?: string; source?: string; model?: string }) => ({
            url: c.url,
            title: c.title || "",
            domain: c.domain || new URL(c.url).hostname,
            model: c.source || c.model || "unknown",
        }));
    }

    // Handle sources as citations
    if (data.sources && Array.isArray(data.sources)) {
        result.citations = [...(result.citations || []), ...data.sources.map((s: string | { url?: string; link?: string; title?: string }) => {
            if (typeof s === "string") {
                try {
                    return { url: s, domain: new URL(s).hostname };
                } catch {
                    return { url: s, domain: s };
                }
            }
            return {
                url: s.url || s.link || "",
                title: s.title || "",
                domain: s.url ? new URL(s.url).hostname : "",
            };
        })];
    }

    // Audit results / history
    if (data.audit_results || data.results || data.history) {
        const audits = data.audit_results || data.results || data.history;
        result.audit_results = audits.map((a: { prompt_text?: string; query?: string; prompt?: string; model_results?: ImportedAuditResult["model_results"]; responses?: ImportedAuditResult["model_results"]; created_at?: string; date?: string; timestamp?: string; share_of_voice?: number; sov?: number; average_rank?: number; rank?: number }) => ({
            prompt_text: a.prompt_text || a.query || a.prompt || "",
            model_results: a.model_results || a.responses || [],
            created_at: a.created_at || a.date || a.timestamp || new Date().toISOString(),
            share_of_voice: a.share_of_voice || a.sov || 0,
            average_rank: a.average_rank || a.rank || null,
        }));
    }

    // Brand tags
    if (data.brand_tags) {
        result.brand_tags = data.brand_tags;
    } else if (data.tags) {
        result.brand_tags = data.tags;
    }

    // Competitors
    if (data.competitors) {
        result.competitors = data.competitors.map((c: string | { name: string }) =>
            typeof c === "string" ? c : c.name
        );
    }

    // Metadata
    result.metadata = {
        source: data.metadata?.source || data.source || "unknown",
        exported_at: data.metadata?.exported_at || data.exported_at || new Date().toISOString(),
        version: data.metadata?.version || data.version || "1.0",
    };

    return result;
}

function parseCSVImport(content: string, type: "prompts" | "citations"): ImportData {
    const lines = content.trim().split("\n");
    if (lines.length < 2) return { prompts: [], citations: [] };

    const header = lines[0].toLowerCase().split(",").map(h => h.trim().replace(/"/g, ""));
    const result: ImportData = { prompts: [], citations: [] };

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(",").map(v => v.trim().replace(/"/g, ""));

        if (type === "prompts") {
            const textIdx = header.findIndex(h => ["prompt", "text", "query", "keyword"].includes(h));
            const categoryIdx = header.findIndex(h => ["category", "type", "group"].includes(h));

            if (textIdx >= 0 && values[textIdx]) {
                result.prompts!.push({
                    text: values[textIdx],
                    category: categoryIdx >= 0 ? values[categoryIdx] : undefined,
                    niche_level: "medium",
                });
            }
        } else if (type === "citations") {
            const urlIdx = header.findIndex(h => ["url", "link", "source"].includes(h));
            const titleIdx = header.findIndex(h => ["title", "name", "page"].includes(h));
            const domainIdx = header.findIndex(h => ["domain", "site", "host"].includes(h));

            if (urlIdx >= 0 && values[urlIdx]) {
                const url = values[urlIdx];
                result.citations!.push({
                    url,
                    title: titleIdx >= 0 ? values[titleIdx] : "",
                    domain: domainIdx >= 0 ? values[domainIdx] : (url.includes("://") ? new URL(url).hostname : url),
                });
            }
        }
    }

    return result;
}

function parseTXTImport(content: string): ImportData {
    const lines = content.trim().split("\n").filter(l => l.trim());
    return {
        prompts: lines.map(line => ({
            text: line.trim(),
            niche_level: "medium",
        })),
    };
}

// ============================================
// MAIN COMPONENT
// ============================================

export function UniversalImport({ clientId, onImportComplete }: UniversalImportProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showDialog, setShowDialog] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importStep, setImportStep] = useState<"upload" | "preview" | "complete">("upload");
    const [importType, setImportType] = useState<"auto" | "prompts" | "citations">("auto");
    const [parsedData, setParsedData] = useState<ImportData | null>(null);
    const [importResults, setImportResults] = useState<{
        prompts: number;
        citations: number;
        audits: number;
        errors: string[];
    }>({ prompts: 0, citations: 0, audits: 0, errors: [] });

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            const ext = file.name.split(".").pop()?.toLowerCase();

            let data: ImportData;

            if (ext === "json") {
                data = parseJSONImport(content);
            } else if (ext === "csv") {
                data = parseCSVImport(content, importType === "citations" ? "citations" : "prompts");
            } else {
                data = parseTXTImport(content);
            }

            setParsedData(data);
            setImportStep("preview");
        } catch (err) {
            console.error("[UniversalImport] Parse error:", err);
            setImportResults({
                prompts: 0,
                citations: 0,
                audits: 0,
                errors: [`Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}`],
            });
        }
    };

    const executeImport = async () => {
        if (!parsedData) return;

        setImporting(true);
        const results = { prompts: 0, citations: 0, audits: 0, errors: [] as string[] };

        try {
            // Import prompts
            if (parsedData.prompts && parsedData.prompts.length > 0) {
                const promptsToInsert = parsedData.prompts
                    .filter(p => p.text && p.text.trim())
                    .map(p => ({
                        client_id: clientId,
                        prompt_text: p.text.trim(),
                        category: p.category || "imported",
                        niche_level: p.niche_level || "medium",
                        is_active: true,
                    }));

                if (promptsToInsert.length > 0) {
                    const { error } = await supabase
                        .from("prompts")
                        .insert(promptsToInsert);

                    if (error) {
                        results.errors.push(`Prompts: ${error.message}`);
                    } else {
                        results.prompts = promptsToInsert.length;
                    }
                }
            }

            // Import citations
            if (parsedData.citations && parsedData.citations.length > 0) {
                const citationsToInsert = parsedData.citations
                    .filter(c => c.url && c.url.trim())
                    .map(c => ({
                        client_id: clientId,
                        url: c.url.trim(),
                        title: c.title || "",
                        domain: c.domain || "",
                        model_id: c.model || "imported",
                        mention_count: 1,
                    }));

                if (citationsToInsert.length > 0) {
                    const { error } = await supabase
                        .from("citations")
                        .insert(citationsToInsert);

                    if (error) {
                        results.errors.push(`Citations: ${error.message}`);
                    } else {
                        results.citations = citationsToInsert.length;
                    }
                }
            }

            // Import brand tags & competitors to client
            if ((parsedData.brand_tags && parsedData.brand_tags.length > 0) ||
                (parsedData.competitors && parsedData.competitors.length > 0)) {

                const { data: clientData } = await supabase
                    .from("clients")
                    .select("brand_tags, competitors")
                    .eq("id", clientId)
                    .single();

                if (clientData) {
                    const existingTags = clientData.brand_tags || [];
                    const existingCompetitors = clientData.competitors || [];

                    const newTags = [...new Set([...existingTags, ...(parsedData.brand_tags || [])])];
                    const newCompetitors = [...new Set([...existingCompetitors, ...(parsedData.competitors || [])])];

                    await supabase
                        .from("clients")
                        .update({ brand_tags: newTags, competitors: newCompetitors })
                        .eq("id", clientId);
                }
            }

            // Import audit results as schedule_runs for historical tracking
            if (parsedData.audit_results && parsedData.audit_results.length > 0) {
                const runsToInsert = parsedData.audit_results.map(a => ({
                    client_id: clientId,
                    schedule_id: null,
                    prompt_id: null,
                    prompt_text: a.prompt_text,
                    status: "completed",
                    share_of_voice: a.share_of_voice || 0,
                    visibility_score: 0,
                    average_rank: a.average_rank || null,
                    total_citations: a.model_results?.reduce((sum, mr) => sum + (mr.citations?.length || 0), 0) || 0,
                    total_cost: 0,
                    model_results: a.model_results || [],
                    tavily_results: null,
                    sources: a.model_results?.flatMap(mr =>
                        mr.citations?.map(c => ({ url: c.url, title: c.title || "", domain: c.domain || "" })) || []
                    ) || [],
                    started_at: a.created_at || new Date().toISOString(),
                    completed_at: a.created_at || new Date().toISOString(),
                }));

                if (runsToInsert.length > 0) {
                    const { error } = await supabase
                        .from("schedule_runs")
                        .insert(runsToInsert);

                    if (error) {
                        results.errors.push(`Audit results: ${error.message}`);
                    } else {
                        results.audits = runsToInsert.length;
                    }
                }
            }

            setImportResults(results);
            setImportStep("complete");

            if (results.errors.length === 0) {
                onImportComplete?.();
            }
        } catch (err) {
            console.error("[UniversalImport] Import error:", err);
            results.errors.push(err instanceof Error ? err.message : "Unknown error");
            setImportResults(results);
        } finally {
            setImporting(false);
        }
    };

    const resetImport = () => {
        setParsedData(null);
        setImportStep("upload");
        setImportResults({ prompts: 0, citations: 0, audits: 0, errors: [] });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const totalItems = parsedData ?
        (parsedData.prompts?.length || 0) +
        (parsedData.citations?.length || 0) +
        (parsedData.audit_results?.length || 0) : 0;

    return (
        <>
            {/* Import Card */}
            <Card className="border-dashed border-2 border-gray-200 hover:border-gray-300 transition-colors">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-gray-700">
                        <Upload className="h-5 w-5" />
                        Import Data
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-500 mb-4">
                        Migrate from competitors or import your data. Supports prompts, citations, audit history, and more.
                    </p>
                    <div className="flex items-center gap-3">
                        <Button onClick={() => setShowDialog(true)} variant="outline" className="gap-2">
                            <Database className="h-4 w-4" />
                            Import Data
                        </Button>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                            <FileJson className="h-4 w-4" /> JSON
                            <FileSpreadsheet className="h-4 w-4" /> CSV
                            <FileText className="h-4 w-4" /> TXT
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Import Dialog */}
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetImport(); }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Import Data</DialogTitle>
                    </DialogHeader>

                    {importStep === "upload" && (
                        <div className="space-y-4 py-4">
                            <div>
                                <Label>Import Type</Label>
                                <Select value={importType} onValueChange={(v) => setImportType(v as typeof importType)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">Auto-detect (JSON)</SelectItem>
                                        <SelectItem value="prompts">Prompts/Keywords (CSV/TXT)</SelectItem>
                                        <SelectItem value="citations">Citations/Sources (CSV)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500 mt-1">
                                    JSON files auto-detect all data types
                                </p>
                            </div>

                            <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-blue-300 transition-colors">
                                <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
                                <p className="text-sm text-gray-600 mb-2">
                                    Drop your file here or click to browse
                                </p>
                                <p className="text-xs text-gray-400">
                                    Supports JSON, CSV, and TXT files
                                </p>
                                <Input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json,.csv,.txt"
                                    onChange={handleFileSelect}
                                    className="mt-4"
                                />
                            </div>

                            <div className="bg-blue-50 rounded-lg p-3">
                                <h4 className="text-sm font-medium text-blue-800 mb-2">Supported Formats</h4>
                                <ul className="text-xs text-blue-600 space-y-1">
                                    <li>• <strong>JSON:</strong> Full export with prompts, citations, history</li>
                                    <li>• <strong>CSV:</strong> Columns like "prompt", "url", "title"</li>
                                    <li>• <strong>TXT:</strong> One prompt per line</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {importStep === "preview" && parsedData && (
                        <div className="space-y-4 py-4">
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h4 className="font-medium text-gray-800 mb-3">Data to Import</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {parsedData.prompts && parsedData.prompts.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <MessageSquare className="h-4 w-4 text-blue-500" />
                                            <span className="text-sm">{parsedData.prompts.length} prompts</span>
                                        </div>
                                    )}
                                    {parsedData.citations && parsedData.citations.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Link2 className="h-4 w-4 text-green-500" />
                                            <span className="text-sm">{parsedData.citations.length} citations</span>
                                        </div>
                                    )}
                                    {parsedData.audit_results && parsedData.audit_results.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="h-4 w-4 text-purple-500" />
                                            <span className="text-sm">{parsedData.audit_results.length} audit results</span>
                                        </div>
                                    )}
                                    {parsedData.brand_tags && parsedData.brand_tags.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">{parsedData.brand_tags.length} tags</Badge>
                                        </div>
                                    )}
                                    {parsedData.competitors && parsedData.competitors.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <Building2 className="h-4 w-4 text-orange-500" />
                                            <span className="text-sm">{parsedData.competitors.length} competitors</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Preview samples */}
                            {parsedData.prompts && parsedData.prompts.length > 0 && (
                                <div>
                                    <h5 className="text-sm font-medium text-gray-600 mb-2">Sample Prompts</h5>
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                        {parsedData.prompts.slice(0, 3).map((p, i) => (
                                            <div key={i} className="text-xs bg-gray-50 rounded px-2 py-1 truncate">
                                                {p.text}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {parsedData.metadata?.source && (
                                <div className="text-xs text-gray-500">
                                    Source: {parsedData.metadata.source}
                                </div>
                            )}
                        </div>
                    )}

                    {importStep === "complete" && (
                        <div className="space-y-4 py-4">
                            {importResults.errors.length === 0 ? (
                                <div className="text-center">
                                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                                    <h4 className="font-medium text-gray-800 mb-2">Import Complete!</h4>
                                    <div className="space-y-1 text-sm text-gray-600">
                                        {importResults.prompts > 0 && <p>{importResults.prompts} prompts imported</p>}
                                        {importResults.citations > 0 && <p>{importResults.citations} citations imported</p>}
                                        {importResults.audits > 0 && <p>{importResults.audits} audit results imported</p>}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
                                    <h4 className="font-medium text-gray-800 mb-2">Import Completed with Errors</h4>
                                    <div className="space-y-1 text-sm text-red-600 bg-red-50 rounded p-3">
                                        {importResults.errors.map((err, i) => (
                                            <p key={i}>{err}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        {importStep === "upload" && (
                            <Button variant="outline" onClick={() => setShowDialog(false)}>
                                Cancel
                            </Button>
                        )}
                        {importStep === "preview" && (
                            <>
                                <Button variant="outline" onClick={resetImport}>
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                </Button>
                                <Button onClick={executeImport} disabled={importing || totalItems === 0}>
                                    {importing ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <ArrowRight className="h-4 w-4 mr-2" />
                                    )}
                                    Import {totalItems} items
                                </Button>
                            </>
                        )}
                        {importStep === "complete" && (
                            <Button onClick={() => { setShowDialog(false); resetImport(); }}>
                                Done
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".json,.csv,.txt"
                className="hidden"
                onChange={handleFileSelect}
            />
        </>
    );
}

export default UniversalImport;
