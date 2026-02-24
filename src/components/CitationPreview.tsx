import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ExternalLink, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Clock, Globe, Quote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CitationPreviewProps {
    domain: string;
    url: string;
}

export function CitationPreview({ domain, url }: CitationPreviewProps) {
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<{
        pageContent: string | null;
        verificationStatus: string;
        similarityScore: number | null;
        matchedParagraph: string | null;
    } | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchPreview() {
            try {
                const cleanDomain = domain.replace(/^www\./, '');

                const { data, error } = await supabase
                    .from('citation_intelligence')
                    .select('page_content, verification_status, similarity_score, matched_paragraph')
                    .or(`domain.eq.${cleanDomain},domain.eq.www.${cleanDomain},url.eq.${url}`)
                    .not('verification_status', 'eq', 'pending')
                    .order('verified_at', { ascending: false, nullsFirst: false })
                    .limit(1);

                if (cancelled) return;

                if (error) {
                    console.error('[CitationPreview] Supabase error:', error);
                    setContent(null);
                    setLoading(false);
                    return;
                }

                if (!data || data.length === 0) {
                    const { data: urlData } = await supabase
                        .from('citation_intelligence')
                        .select('page_content, verification_status, similarity_score, matched_paragraph')
                        .ilike('url', `%${cleanDomain}%`)
                        .not('verification_status', 'eq', 'pending')
                        .order('verified_at', { ascending: false, nullsFirst: false })
                        .limit(1);

                    if (cancelled) return;

                    if (urlData && urlData.length > 0) {
                        setContent({
                            pageContent: urlData[0].page_content,
                            verificationStatus: urlData[0].verification_status || 'pending',
                            similarityScore: urlData[0].similarity_score,
                            matchedParagraph: urlData[0].matched_paragraph
                        });
                    } else {
                        setContent(null);
                    }
                    setLoading(false);
                    return;
                }

                setContent({
                    pageContent: data[0].page_content,
                    verificationStatus: data[0].verification_status || 'pending',
                    similarityScore: data[0].similarity_score,
                    matchedParagraph: data[0].matched_paragraph
                });
            } catch (err) {
                console.error('[CitationPreview] Failed:', err);
                if (!cancelled) setContent(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchPreview();
        return () => { cancelled = true; };
    }, [domain, url]);

    if (loading) {
        return (
            <Card className="w-[460px] shadow-xl border border-gray-200 bg-white animate-in fade-in duration-150">
                <div className="p-5 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    <span className="text-sm text-gray-500">Loading preview...</span>
                </div>
            </Card>
        );
    }

    // Not verified yet
    if (!content) {
        return (
            <Card className="w-[460px] shadow-xl border border-gray-200 bg-white animate-in fade-in duration-150">
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex items-center gap-2.5">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" className="h-4 w-4 rounded" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{domain}</span>
                    </div>
                </div>
                <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-600">Verification Pending</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                        This citation will be verified automatically by the background process, or click "Verify Citations" to verify now.
                    </p>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" />
                        Open original page
                    </a>
                </div>
            </Card>
        );
    }

    const score = content.similarityScore;
    const scorePercent = score !== null ? Math.round(score * 100) : null;

    const getStatusConfig = () => {
        switch (content.verificationStatus) {
            case 'verified':
                return { icon: <ShieldCheck className="h-4 w-4" />, label: 'Verified Citation', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', barColor: 'bg-emerald-500', iconColor: 'text-emerald-600' };
            case 'partially_verified':
                return { icon: <ShieldAlert className="h-4 w-4" />, label: 'Partially Verified', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', barColor: 'bg-amber-500', iconColor: 'text-amber-500' };
            case 'hallucinated':
                return { icon: <ShieldX className="h-4 w-4" />, label: 'Hallucinated', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', barColor: 'bg-red-500', iconColor: 'text-red-500' };
            case 'error':
                return { icon: <AlertTriangle className="h-4 w-4" />, label: 'Fetch Error', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', barColor: 'bg-orange-400', iconColor: 'text-orange-500' };
            default:
                return { icon: <Globe className="h-4 w-4" />, label: 'Unknown', bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600', barColor: 'bg-gray-400', iconColor: 'text-gray-400' };
        }
    };

    const status = getStatusConfig();

    return (
        <Card className={`w-[460px] max-h-[520px] overflow-hidden shadow-xl border ${status.border} bg-white animate-in fade-in duration-150`}>
            {/* Header: Domain + Status + Score */}
            <div className={`px-4 py-3 ${status.bg} border-b ${status.border}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt="" className="h-4 w-4 rounded flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{domain}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {scorePercent !== null && (
                            <div className="flex items-center gap-1.5">
                                <div className="w-20 h-2 bg-white/60 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${status.barColor}`} style={{ width: `${scorePercent}%` }} />
                                </div>
                                <span className={`text-xs font-bold ${status.text} tabular-nums`}>{scorePercent}%</span>
                            </div>
                        )}
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${status.text} ${status.iconColor}`}>
                            {status.icon}
                            {status.label}
                        </div>
                    </div>
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-blue-600 truncate block mt-1" onClick={e => e.stopPropagation()}>
                    {url}
                </a>
            </div>

            {/* Matched Evidence (highlighted) */}
            {content.matchedParagraph && (
                <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                    <div className="flex items-start gap-2">
                        <Quote className="h-3.5 w-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider mb-1">Matched Evidence</div>
                            <p className="text-xs text-blue-700 leading-relaxed italic">
                                "{content.matchedParagraph.length > 300 ? content.matchedParagraph.substring(0, 300) + '...' : content.matchedParagraph}"
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Page Content Preview */}
            {content.pageContent ? (
                <div className="px-4 py-3 max-h-56 overflow-y-auto">
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Page Content</div>
                    <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {content.pageContent.substring(0, 2000)}
                        {content.pageContent.length > 2000 && <span className="text-gray-400">...</span>}
                    </div>
                </div>
            ) : content.verificationStatus === 'error' ? (
                <div className="px-4 py-3">
                    <p className="text-xs text-gray-500">Could not fetch page content. The page may be down or blocking automated access.</p>
                </div>
            ) : (
                <div className="px-4 py-3">
                    <p className="text-xs text-gray-500">Page content not cached. The citation was verified based on fetched content.</p>
                </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-[11px] text-gray-400">Citation Intelligence</span>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium" onClick={e => e.stopPropagation()}>
                    <ExternalLink className="h-3 w-3" />
                    Open page
                </a>
            </div>
        </Card>
    );
}
