/**
 * ============================================================================
 * RSS INGESTION EDGE FUNCTION
 * ============================================================================
 * 
 * Polls RSS feeds (Google Alerts, etc.) to detect fresh web content.
 * 
 * Features:
 * - Fetches due feeds based on poll_interval
 * - Parses RSS/Atom XML
 * - Extracts URL, title, published_at, domain
 * - Detects brand/competitor mentions
 * - Stores in fresh_signals table
 * - Supports conditional requests (ETag, Last-Modified)
 * 
 * @version 1.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================
// TYPES
// ============================================

interface RSSFeed {
    id: string;
    client_id: string;
    name: string;
    rss_url: string;
    feed_type: string;
    topic: string | null;
    brand_keywords: string[] | null;
    competitor_keywords: string[] | null;
    etag: string | null;
    last_modified: string | null;
}

interface FreshSignal {
    client_id: string;
    feed_id: string;
    url: string;
    url_hash: string;
    title: string;
    content_snippet: string;
    published_at: string | null;
    discovered_at: string;
    source_domain: string;
    matched_topic: string | null;
    brand_mentions: string[];
    competitor_mentions: string[];
    content_type: string;
    processing_status: string;
}

// ============================================
// HELPERS
// ============================================

function hashUrl(url: string): string {
    // Simple hash for URL deduplication
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(36);
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace("www.", "");
    } catch {
        return url;
    }
}

function detectMentions(text: string, keywords: string[]): string[] {
    if (!text || !keywords?.length) return [];
    const lowerText = text.toLowerCase();
    return keywords.filter(kw => lowerText.includes(kw.toLowerCase()));
}

function classifyContentType(title: string): string {
    const lower = title.toLowerCase();
    if (lower.includes("best") || lower.includes("top ") || lower.includes("ranking")) return "listicle";
    if (lower.includes("review") || lower.includes("rated")) return "review";
    if (lower.includes("news") || lower.includes("announces") || lower.includes("update")) return "news";
    if (lower.includes("how to") || lower.includes("guide")) return "guide";
    return "blog";
}

// ============================================
// RSS PARSER
// ============================================

interface RSSItem {
    title: string;
    link: string;
    description: string;
    pubDate: string | null;
    guid: string | null;
}

function parseRSS(xmlText: string): RSSItem[] {
    const items: RSSItem[] = [];

    // Simple XML parsing for RSS/Atom feeds
    const itemMatches = xmlText.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);

    for (const match of itemMatches) {
        const itemXml = match[1];

        const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
        const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        const descMatch = itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
        const pubDateMatch = itemXml.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
        const guidMatch = itemXml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);

        if (linkMatch?.[1]) {
            items.push({
                title: titleMatch?.[1]?.trim() || "",
                link: linkMatch[1].trim(),
                description: descMatch?.[1]?.trim() || "",
                pubDate: pubDateMatch?.[1]?.trim() || null,
                guid: guidMatch?.[1]?.trim() || null,
            });
        }
    }

    // Also try Atom format
    if (items.length === 0) {
        const entryMatches = xmlText.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi);

        for (const match of entryMatches) {
            const entryXml = match[1];

            const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            const linkMatch = entryXml.match(/<link[^>]*href="([^"]+)"/i);
            const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
            const publishedMatch = entryXml.match(/<published[^>]*>([\s\S]*?)<\/published>/i);
            const idMatch = entryXml.match(/<id[^>]*>([\s\S]*?)<\/id>/i);

            if (linkMatch?.[1]) {
                items.push({
                    title: titleMatch?.[1]?.trim() || "",
                    link: linkMatch[1].trim(),
                    description: summaryMatch?.[1]?.trim() || "",
                    pubDate: publishedMatch?.[1]?.trim() || null,
                    guid: idMatch?.[1]?.trim() || null,
                });
            }
        }
    }

    return items;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get request body for specific feed polling, or poll all due feeds
        const body = await req.json().catch(() => ({}));
        const specificFeedId = body.feed_id;

        // Fetch due feeds
        let feedsQuery = supabase
            .from("rss_feeds")
            .select("*")
            .eq("is_active", true);

        if (specificFeedId) {
            feedsQuery = feedsQuery.eq("id", specificFeedId);
        } else {
            // Get feeds that are due for polling
            feedsQuery = feedsQuery.or(
                `last_polled_at.is.null,last_polled_at.lt.${new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()}`
            );
        }

        const { data: feeds, error: feedsError } = await feedsQuery.limit(20);

        if (feedsError) throw feedsError;
        if (!feeds?.length) {
            return new Response(
                JSON.stringify({ success: true, message: "No feeds due for polling", processed: 0 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[RSS Ingestor] Polling ${feeds.length} feeds`);

        const results = {
            processed: 0,
            signals_created: 0,
            errors: [] as string[],
        };

        for (const feed of feeds as RSSFeed[]) {
            try {
                console.log(`[RSS Ingestor] Fetching: ${feed.name} (${feed.rss_url})`);

                // Prepare headers for conditional request
                const headers: Record<string, string> = {
                    "User-Agent": "Forzeo/1.0 RSS Aggregator",
                };
                if (feed.etag) headers["If-None-Match"] = feed.etag;
                if (feed.last_modified) headers["If-Modified-Since"] = feed.last_modified;

                const response = await fetch(feed.rss_url, { headers });

                // Handle 304 Not Modified
                if (response.status === 304) {
                    console.log(`[RSS Ingestor] No new content for: ${feed.name}`);
                    await supabase.from("rss_feeds").update({
                        last_polled_at: new Date().toISOString(),
                        last_poll_status: "no_new_content",
                    }).eq("id", feed.id);
                    results.processed++;
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const xmlText = await response.text();
                const items = parseRSS(xmlText);

                console.log(`[RSS Ingestor] Found ${items.length} items in ${feed.name}`);

                // Get client's brand and competitor keywords
                const { data: client } = await supabase
                    .from("clients")
                    .select("brand_name, brand_tags, competitors")
                    .eq("id", feed.client_id)
                    .single();

                const brandKeywords = [
                    client?.brand_name,
                    ...(client?.brand_tags || []),
                    ...(feed.brand_keywords || []),
                ].filter(Boolean);

                const competitorKeywords = [
                    ...(client?.competitors || []),
                    ...(feed.competitor_keywords || []),
                ].filter(Boolean);

                // Process each item
                for (const item of items) {
                    const urlHash = hashUrl(item.link);
                    const domain = extractDomain(item.link);
                    const textToAnalyze = `${item.title} ${item.description}`;

                    const signal: FreshSignal = {
                        client_id: feed.client_id,
                        feed_id: feed.id,
                        url: item.link,
                        url_hash: urlHash,
                        title: item.title.substring(0, 500),
                        content_snippet: item.description.substring(0, 1000),
                        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : null,
                        discovered_at: new Date().toISOString(),
                        source_domain: domain,
                        matched_topic: feed.topic,
                        brand_mentions: detectMentions(textToAnalyze, brandKeywords),
                        competitor_mentions: detectMentions(textToAnalyze, competitorKeywords),
                        content_type: classifyContentType(item.title),
                        processing_status: "pending",
                    };

                    // Upsert signal (skip if already exists)
                    const { error: signalError } = await supabase
                        .from("fresh_signals")
                        .upsert(signal, {
                            onConflict: "client_id,url_hash",
                            ignoreDuplicates: true,
                        });

                    if (!signalError) {
                        results.signals_created++;
                    }
                }

                // Update feed metadata
                await supabase.from("rss_feeds").update({
                    last_polled_at: new Date().toISOString(),
                    last_poll_status: "success",
                    last_poll_error: null,
                    etag: response.headers.get("ETag") || null,
                    last_modified: response.headers.get("Last-Modified") || null,
                    items_fetched_total: (feed as RSSFeed & { items_fetched_total?: number }).items_fetched_total
                        ? (feed as RSSFeed & { items_fetched_total: number }).items_fetched_total + items.length
                        : items.length,
                }).eq("id", feed.id);

                results.processed++;

            } catch (err) {
                console.error(`[RSS Ingestor] Error for ${feed.name}:`, err);
                results.errors.push(`${feed.name}: ${err instanceof Error ? err.message : String(err)}`);

                // Update feed with error
                await supabase.from("rss_feeds").update({
                    last_polled_at: new Date().toISOString(),
                    last_poll_status: "error",
                    last_poll_error: err instanceof Error ? err.message : String(err),
                }).eq("id", feed.id);
            }
        }

        console.log(`[RSS Ingestor] Complete: ${results.processed} feeds, ${results.signals_created} signals`);

        return new Response(
            JSON.stringify({ success: true, ...results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("[RSS Ingestor] Fatal error:", err);
        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
