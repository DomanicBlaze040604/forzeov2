import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ExternalLink, CheckCircle, AlertTriangle, X } from 'lucide-react';
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
        async function fetchPreview() {
            try {
                console.log('[CitationPreview] Fetching preview for domain:', domain);
                const { data, error } = await supabase
                    .from('citation_intelligence')
                    .select('page_content, verification_status, similarity_score, matched_paragraph')
                    .eq('domain', domain)
                    .limit(1);

                if (error) {
                    console.error('[CitationPreview] Supabase error:', error);
                    throw error;
                }

                if (!data || data.length === 0) {
                    console.warn('[CitationPreview] No data found for domain:', domain);
                    setContent(null);
                    setLoading(false);
                    return;
                }

                console.log('[CitationPreview] Data loaded:', data[0]);
                setContent({
                    pageContent: data[0].page_content,
                    verificationStatus: data[0].verification_status || 'pending',
                    similarityScore: data[0].similarity_score,
                    matchedParagraph: data[0].matched_paragraph
                });
            } catch (err) {
                console.error('[CitationPreview] Failed to load preview:', err);
                setContent(null);
            } finally {
                setLoading(false);
            }
        }

        fetchPreview();
    }, [domain]);

    if (loading) {
        return (
            <Card className="relative w-96 max-h-96 overflow-hidden shadow-xl border border-gray-200 bg-white animate-in fade-in duration-200">
                <div className="p-6 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    <span className="ml-2 text-sm text-gray-500">Loading preview...</span>
                </div>
            </Card>
        );
    }

    if (!content?.pageContent) {
        return (
            <Card className="relative w-96 max-h-96 overflow-hidden shadow-xl border border-gray-200 bg-white animate-in fade-in duration-200">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <span className="text-sm font-medium text-gray-700">No Preview Available</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">
                        Run "Verify Citations" to fetch and cache page content.
                    </p>
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                        <ExternalLink className="h-3 w-3" />
                        Open original page
                    </a>
                </div>
            </Card>
        );
    }

    const getStatusBadge = () => {
        switch (content.verificationStatus) {
            case 'verified':
                return (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                    </div>
                );
            case 'partially_verified':
                return (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded text-xs font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        Partial
                    </div>
                );
            case 'hallucinated':
                return (
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-xs font-medium">
                        <X className="h-3 w-3" />
                        Hallucinated
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Card className="relative w-[480px] max-h-[500px] overflow-hidden shadow-xl border border-gray-200 bg-white animate-in fade-in duration-200">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <img
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
                                alt=""
                                className="h-4 w-4 rounded"
                            />
                            <span className="text-sm font-semibold text-gray-900 truncate">{domain}</span>
                        </div>
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-gray-500 hover:text-blue-600 truncate block"
                        >
                            {url}
                        </a>
                    </div>
                    {getStatusBadge()}
                </div>
            </div>

            {/* Content Preview */}
            <div className="p-4 max-h-64 overflow-y-auto">
                <div className="prose prose-sm max-w-none">
                    <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                        {content.pageContent.substring(0, 1500)}
                        {content.pageContent.length > 1500 && '...'}
                    </div>
                </div>
            </div>

            {/* Matched Paragraph (if available) */}
            {content.matchedParagraph && (
                <div className="p-4 border-t border-gray-100 bg-blue-50">
                    <div className="text-xs font-semibold text-blue-900 mb-1">Matched Evidence:</div>
                    <div className="text-xs text-blue-700 italic">"{content.matchedParagraph}"</div>
                    {content.similarityScore !== null && (
                        <div className="text-xs text-blue-600 mt-1">
                            Confidence: {(content.similarityScore * 100).toFixed(0)}%
                        </div>
                    )}
                </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-500">Hover away to close</span>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                    <ExternalLink className="h-3 w-3" />
                    Open full page
                </a>
            </div>
        </Card>
    );
}
