import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ExternalLink, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Clock, Globe, Quote, Search, Tag, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CitationPreviewProps {
    domain: string;
    url: string;
}

interface CitationData {
    pageContent: string | null;
    verificationStatus: string;
    similarityScore: number | null;
    matchedParagraph: string | null;
    aiAnalysis: {
        reasoning?: string;
        page_summary?: string;
        entity_match?: boolean;
    } | null;
    brandMentioned: boolean;
    category: string | null;
    relationshipType: string | null;
    authorityTier: number | null;
}

export function CitationPreview({ domain, url }: CitationPreviewProps) {
    const [loading, setLoading] = useState(true);
    const [content, setContent] = useState<CitationData | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchPreview() {
            try {
                const cleanDomain = domain.replace(/^www\./, '');

                const { data, error } = await supabase
                    .from('citation_intelligence')
                    .select('page_content, verification_status, similarity_score, matched_paragraph, ai_analysis, brand_mentioned_in_source, citation_category, relationship_type, authority_tier')
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
                        .select('page_content, verification_status, similarity_score, matched_paragraph, ai_analysis, brand_mentioned_in_source, citation_category, relationship_type, authority_tier')
                        .ilike('url', `%${cleanDomain}%`)
                        .not('verification_status', 'eq', 'pending')
                        .order('verified_at', { ascending: false, nullsFirst: false })
                        .limit(1);

                    if (cancelled) return;

                    if (urlData && urlData.length > 0) {
                        setContent(mapRow(urlData[0]));
                    } else {
                        setContent(null);
                    }
                    setLoading(false);
                    return;
                }

                setContent(mapRow(data[0]));
            } catch (err) {
                console.error('[CitationPreview] Failed:', err);
                if (!cancelled) setContent(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        function mapRow(row: any): CitationData {
            const aiAnalysis = typeof row.ai_analysis === 'object' && row.ai_analysis !== null
                ? row.ai_analysis
                : {};
            return {
                pageContent: row.page_content,
                verificationStatus: row.verification_status || 'pending',
                similarityScore: row.similarity_score,
                matchedParagraph: row.matched_paragraph,
                aiAnalysis: {
                    reasoning: aiAnalysis.reasoning || null,
                    page_summary: aiAnalysis.page_summary || null,
                    entity_match: aiAnalysis.entity_match || false,
                },
                brandMentioned: row.brand_mentioned_in_source || false,
                category: row.citation_category || null,
                relationshipType: row.relationship_type || null,
                authorityTier: row.authority_tier || null,
            };
        }

        fetchPreview();
        return () => { cancelled = true; };
    }, [domain, url]);

    if (loading) {
        return (
            <Card className="w-[480px] shadow-2xl border border-gray-200/80 bg-white animate-in fade-in duration-150 rounded-xl overflow-hidden">
                <div className="p-5 flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    <span className="text-sm text-gray-500">Analyzing citation...</span>
                </div>
            </Card>
        );
    }

    // Not verified yet
    if (!content) {
        return (
            <Card className="w-[480px] shadow-2xl border border-gray-200/80 bg-white animate-in fade-in duration-150 rounded-xl overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" className="h-5 w-5 rounded" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{domain}</span>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-400 hover:text-blue-500 truncate block mt-1.5 transition-colors" onClick={e => e.stopPropagation()}>
                        {url}
                    </a>
                </div>
                <div className="p-5">
                    <div className="flex items-center gap-2.5 mb-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Clock className="h-4 w-4 text-gray-400" />
                        </div>
                        <div>
                            <span className="text-sm font-semibold text-gray-700 block">Verification Pending</span>
                            <span className="text-[11px] text-gray-400">Queued for background verification</span>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mt-3 pl-[42px]">
                        This citation will be verified automatically by the background process, or click "Verify Citations" to verify now.
                    </p>
                </div>
                <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Citation Intelligence</span>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" />
                        Open page
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
                return {
                    icon: <ShieldCheck className="h-4 w-4" />,
                    label: 'Verified Citation',
                    tooltip: 'Similarity score >= 70%. The cited page content strongly matches the AI response claim.',
                    bg: 'bg-emerald-500',
                    bgLight: 'bg-emerald-50',
                    border: 'border-emerald-200',
                    text: 'text-emerald-700',
                    barColor: 'bg-emerald-400',
                    gradient: 'from-emerald-500 to-emerald-600',
                };
            case 'partially_verified':
                return {
                    icon: <ShieldAlert className="h-4 w-4" />,
                    label: 'Partially Verified',
                    tooltip: 'Similarity score 40-69%. The cited page has some relevant content but doesn\'t fully support the claim.',
                    bg: 'bg-amber-500',
                    bgLight: 'bg-amber-50',
                    border: 'border-amber-200',
                    text: 'text-amber-700',
                    barColor: 'bg-amber-400',
                    gradient: 'from-amber-500 to-amber-600',
                };
            case 'hallucinated':
                return {
                    icon: <ShieldX className="h-4 w-4" />,
                    label: 'Hallucinated',
                    tooltip: 'Similarity score < 40%. The cited page content does not support the AI response claim — likely a hallucinated citation.',
                    bg: 'bg-red-500',
                    bgLight: 'bg-red-50',
                    border: 'border-red-200',
                    text: 'text-red-700',
                    barColor: 'bg-red-400',
                    gradient: 'from-red-500 to-red-600',
                };
            case 'error':
                return {
                    icon: <AlertTriangle className="h-4 w-4" />,
                    label: 'Fetch Error',
                    tooltip: 'Could not fetch the cited page for verification. The page may be behind a paywall, require authentication, or be temporarily unavailable.',
                    bg: 'bg-orange-500',
                    bgLight: 'bg-orange-50',
                    border: 'border-orange-200',
                    text: 'text-orange-700',
                    barColor: 'bg-orange-400',
                    gradient: 'from-orange-400 to-orange-500',
                };
            default:
                return {
                    icon: <Globe className="h-4 w-4" />,
                    label: 'Unknown',
                    tooltip: 'This citation has not been verified yet. Run citation verification to check its accuracy.',
                    bg: 'bg-gray-500',
                    bgLight: 'bg-gray-50',
                    border: 'border-gray-200',
                    text: 'text-gray-600',
                    barColor: 'bg-gray-400',
                    gradient: 'from-gray-400 to-gray-500',
                };
        }
    };

    const status = getStatusConfig();
    const pageSummary = content.aiAnalysis?.page_summary;
    const reasoning = content.aiAnalysis?.reasoning;
    const entityMatch = content.brandMentioned || content.aiAnalysis?.entity_match;

    const getCategoryStyle = (cat: string | null) => {
        const styles: Record<string, string> = {
            owned: 'bg-emerald-100 text-emerald-700',
            competitor: 'bg-red-100 text-red-700',
            editorial: 'bg-purple-100 text-purple-700',
            review: 'bg-amber-100 text-amber-700',
            ecommerce: 'bg-blue-100 text-blue-700',
            social: 'bg-pink-100 text-pink-700',
            ugc: 'bg-cyan-100 text-cyan-700',
            reference: 'bg-indigo-100 text-indigo-700',
            institutional: 'bg-slate-100 text-slate-700',
        };
        return styles[cat || ''] || 'bg-gray-100 text-gray-600';
    };

    return (
        <Card className="w-[480px] max-h-[560px] overflow-hidden shadow-2xl border-0 bg-white animate-in fade-in duration-150 rounded-xl ring-1 ring-black/5">
            {/* Header: Domain + URL */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} alt="" className="h-5 w-5 rounded flex-shrink-0" />
                        <span className="text-sm font-semibold text-gray-900 truncate">{domain}</span>
                    </div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3" />
                        Visit
                    </a>
                </div>
                <p className="text-[11px] text-gray-400 truncate mt-1">{url}</p>
            </div>

            {/* Status Banner */}
            <div className={`px-5 py-3 bg-gradient-to-r ${status.gradient} flex items-center justify-between`}>
                <div className="flex items-center gap-2 text-white">
                    {status.icon}
                    <span className="text-sm font-bold" title={status.tooltip}>{status.label}</span>
                </div>
                <div className="flex items-center gap-3">
                    {entityMatch && (
                        <span className="text-[11px] font-medium text-white/90 bg-white/20 px-2 py-0.5 rounded-full">
                            Brand Detected
                        </span>
                    )}
                    {scorePercent !== null && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-white/30 rounded-full overflow-hidden">
                                <div className="h-full rounded-full bg-white/90" style={{ width: `${scorePercent}%` }} />
                            </div>
                            <span className="text-xs font-bold text-white tabular-nums">{scorePercent}%</span>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Summary — the most useful section */}
            {pageSummary && (
                <div className="px-5 py-3.5 border-b border-gray-100">
                    <div className="flex items-start gap-2.5">
                        <div className="h-6 w-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">About This Page</div>
                            <p className="text-xs text-gray-700 leading-relaxed">
                                {pageSummary.length > 250 ? pageSummary.substring(0, 250) + '...' : pageSummary}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Reasoning — why was this verdict given */}
            {reasoning && (
                <div className={`px-5 py-3 border-b ${status.border} ${status.bgLight}`}>
                    <div className="flex items-start gap-2.5">
                        <div className={`h-6 w-6 rounded-md bg-white flex items-center justify-center flex-shrink-0 mt-0.5 border ${status.border}`}>
                            <Search className={`h-3.5 w-3.5 ${status.text}`} />
                        </div>
                        <div className="min-w-0">
                            <div className={`text-[10px] font-bold ${status.text} uppercase tracking-wider mb-1`}>Verification Reasoning</div>
                            <p className={`text-xs ${status.text} leading-relaxed`}>
                                {reasoning.length > 200 ? reasoning.substring(0, 200) + '...' : reasoning}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Matched Evidence */}
            {content.matchedParagraph && (
                <div className="px-5 py-3 border-b border-blue-100 bg-blue-50/50">
                    <div className="flex items-start gap-2.5">
                        <div className="h-6 w-6 rounded-md bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Quote className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Matched Evidence</div>
                            <p className="text-xs text-blue-800 leading-relaxed italic">
                                "{content.matchedParagraph.length > 250 ? content.matchedParagraph.substring(0, 250) + '...' : content.matchedParagraph}"
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* No AI data fallback — show cleaned page content excerpt */}
            {!pageSummary && !reasoning && content.pageContent && (
                <div className="px-5 py-3 border-b border-gray-100 max-h-36 overflow-y-auto">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Page Content</div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                        {content.pageContent.substring(0, 600)}
                        {content.pageContent.length > 600 && <span className="text-gray-400">...</span>}
                    </p>
                </div>
            )}

            {/* Error state — no content */}
            {!pageSummary && !reasoning && !content.pageContent && content.verificationStatus === 'error' && (
                <div className="px-5 py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500">Could not fetch page content. The page may be down or blocking automated access.</p>
                </div>
            )}

            {/* Meta badges footer */}
            <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {content.category && content.category !== 'other' && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${getCategoryStyle(content.category)}`}>
                            <Tag className="h-2.5 w-2.5" />
                            {content.category.charAt(0).toUpperCase() + content.category.slice(1)}
                        </span>
                    )}
                    {content.relationshipType && content.relationshipType !== 'neutral' && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${content.relationshipType === 'owned' ? 'bg-emerald-100 text-emerald-700' : content.relationshipType === 'competitor' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {content.relationshipType.charAt(0).toUpperCase() + content.relationshipType.slice(1)}
                        </span>
                    )}
                    {content.authorityTier && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${content.authorityTier === 1 ? 'bg-yellow-100 text-yellow-700' : content.authorityTier === 2 ? 'bg-gray-100 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                            Tier {content.authorityTier}
                        </span>
                    )}
                    {!content.category && !content.relationshipType && !content.authorityTier && (
                        <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Citation Intelligence</span>
                    )}
                </div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors" onClick={e => e.stopPropagation()}>
                    <ExternalLink className="h-3 w-3" />
                    Open page
                </a>
            </div>
        </Card>
    );
}
