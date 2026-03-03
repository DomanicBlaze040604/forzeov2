/**
 * Shared dashboard helper functions, constants, and small components.
 */
import { cleanAndAnalyzeResponse } from "@/hooks/useClientDashboard";
import { brandMentionedInText, normalizeBrandToken } from "./brandMatching";

/** Domain type definitions for citation source classification */
export const DOMAIN_TYPES: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  owned: { label: "Owned", color: "text-emerald-700", bg: "bg-emerald-100", dot: "#10b981" },
  competitor: { label: "Competitor", color: "text-red-700", bg: "bg-red-100", dot: "#ef4444" },
  ugc: { label: "UGC", color: "text-cyan-700", bg: "bg-cyan-100", dot: "#06b6d4" },
  editorial: { label: "Editorial", color: "text-purple-700", bg: "bg-purple-100", dot: "#a855f7" },
  review: { label: "Review", color: "text-yellow-700", bg: "bg-yellow-100", dot: "#eab308" },
  reference: { label: "Reference", color: "text-green-700", bg: "bg-green-100", dot: "#22c55e" },
  institutional: { label: "Institutional", color: "text-blue-700", bg: "bg-blue-100", dot: "#3b82f6" },
  social: { label: "Social", color: "text-pink-700", bg: "bg-pink-100", dot: "#ec4899" },
  ecommerce: { label: "E-commerce", color: "text-orange-700", bg: "bg-orange-100", dot: "#f97316" },
  other: { label: "Other", color: "text-gray-700", bg: "bg-gray-100", dot: "#6b7280" },
};

/** Map old/mismatched AI category names to valid DOMAIN_TYPES keys */
export const normalizeCitationCategory = (cat?: string): string => {
  if (!cat) return 'other';
  const map: Record<string, string> = {
    review_sites: 'review', comparison_sites: 'review', blogs: 'editorial',
    marketplaces: 'ecommerce', directories: 'ecommerce', reference_authority: 'reference',
  };
  return map[cat] || (DOMAIN_TYPES[cat] ? cat : 'other');
};

/** Classify a domain into a type based on known domain patterns */
export function classifyDomain(domain: string, clientDomain?: string, competitors?: string[], brandName?: string): string {
  const d = domain.toLowerCase().replace(/^www\./, '');

  if (clientDomain && d.includes(clientDomain.toLowerCase().replace(/^www\./, ''))) return "owned";
  if (brandName) {
    const normalizedBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedBrand.length > 2 && d.includes(normalizedBrand)) return "owned";
  }

  if (competitors) {
    for (const comp of competitors) {
      if (!comp) continue;
      if (d.includes(comp.toLowerCase().replace(/^www\./, ''))) return "competitor";
      const compToken = normalizeBrandToken(comp);
      if (compToken.length >= 3 && d.includes(compToken)) return "competitor";
    }
  }

  if (d.includes('amazon') || d.includes('ebay') || d.includes('walmart') || d.includes('flipkart') ||
    d.includes('zappos') || d.includes('footlocker') || d.includes('finishline') || d.includes('dickssporting')) return "ecommerce";
  if (d.includes('youtube') || d.includes('twitter') || d.includes('x.com') || d.includes('facebook') ||
    d.includes('instagram') || d.includes('tiktok') || d.includes('linkedin') || d.includes('pinterest')) return "social";
  if (d.includes('reddit') || d.includes('quora') || d.includes('discord') || d.includes('stackoverflow') ||
    d.includes('stackexchange')) return "ugc";
  if (d.includes('forbes') || d.includes('techcrunch') || d.includes('wired') || d.includes('nytimes') ||
    d.includes('bbc') || d.includes('cnn') || d.includes('reuters') || d.includes('bloomberg') ||
    d.includes('medium.com')) return "editorial";
  if (d.includes('g2.com') || d.includes('capterra') || d.includes('trustpilot') || d.includes('yelp') ||
    d.includes('tripadvisor') || d.includes('glassdoor') || d.includes('runrepeat')) return "review";
  if (d.includes('wikipedia') || d.includes('wiki')) return "reference";
  if (d.includes('.gov') || d.includes('.edu')) return "institutional";

  return "other";
}

/** Compute position for an audit result using multi-layer fallbacks */
export function computePositionForResult(
  r: any,
  selectedClient: any
): number | null {
  if (!r) return null;

  let pos = r.summary?.average_rank;
  if (pos) return pos;

  const visibleCount = r.model_results.filter((mr: any) => {
    if (mr.brand_mentioned) return true;
    if (selectedClient && mr.raw_response) {
      return brandMentionedInText(mr.raw_response, selectedClient.brand_name, selectedClient.brand_tags || []);
    }
    return false;
  }).length;

  if (visibleCount === 0) return null;

  const ranksFromModels = r.model_results
    .filter((mr: any) => mr.brand_mentioned && mr.brand_rank != null)
    .map((mr: any) => mr.brand_rank as number);
  if (ranksFromModels.length > 0) {
    return Math.round(ranksFromModels.reduce((a: number, b: number) => a + b, 0) / ranksFromModels.length * 10) / 10;
  }

  // 3. Parse rank from raw_response text using cleanAndAnalyzeResponse
  if (selectedClient?.brand_name) {
    const parsedRanks: number[] = [];
    r.model_results.forEach((mr: any) => {
      if (mr.raw_response) {
        const { brandRank } = cleanAndAnalyzeResponse(
          mr.raw_response,
          selectedClient.brand_name,
          selectedClient.competitors || [],
          selectedClient.brand_tags || []
        );
        if (brandRank) parsedRanks.push(brandRank);
      }
    });
    if (parsedRanks.length > 0) {
      return Math.round(parsedRanks.reduce((a, b) => a + b, 0) / parsedRanks.length * 10) / 10;
    }
  }

  // 4. Use extracted_brands position from DataForSEO brand entities API
  const ebPositions: number[] = [];
  r.model_results.forEach((mr: any) => {
    if (mr.extracted_brands) {
      const ownBrand = mr.extracted_brands.find((eb: any) => eb.is_own_brand && eb.position);
      if (ownBrand) ebPositions.push(ownBrand.position);
    }
  });
  if (ebPositions.length > 0) {
    return Math.round(ebPositions.reduce((a, b) => a + b, 0) / ebPositions.length * 10) / 10;
  }

  // 5. Final fallback: if brand is visible, derive position from mention order in text
  //    Count how many competitors appear before the brand in each response
  if (selectedClient?.brand_name) {
    const mentionOrderRanks: number[] = [];
    r.model_results.forEach((mr: any) => {
      if (!mr.raw_response) return;
      const text = mr.raw_response.toLowerCase();
      const brandIdx = text.indexOf(selectedClient.brand_name.toLowerCase());
      if (brandIdx === -1) return; // brand not in this response

      // Count how many competitors appear before the brand
      let rank = 1;
      (selectedClient.competitors || []).forEach((comp: string) => {
        const compIdx = text.indexOf(comp.toLowerCase());
        if (compIdx !== -1 && compIdx < brandIdx) rank++;
      });
      mentionOrderRanks.push(rank);
    });
    if (mentionOrderRanks.length > 0) {
      return Math.round(mentionOrderRanks.reduce((a, b) => a + b, 0) / mentionOrderRanks.length * 10) / 10;
    }
  }

  return null;
}

/** Format Google AI Overview text for display */
export function formatAIOverviewForDisplay(text: string): string {
  if (!text) return '';
  let formatted = text;
  formatted = formatted.replace(/\{Link:\s*([^}]+?)\s*\}/g, '$1');
  formatted = formatted.replace(/([.!?])\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*\s+\+\d+\s+/g, '$1\n\n');
  formatted = formatted.replace(
    /([.!?])\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Za-z0-9]+){0,6})\s*\(([^)]{3,60})\)\s*:/g,
    '$1\n\n- **$2** ($3):'
  );
  formatted = formatted.replace(
    /([.!?])\s+([A-Z][A-Za-z0-9]+(?:[\s-][A-Za-z0-9]+){0,5})\s*:/g,
    '$1\n\n- **$2**:'
  );
  formatted = formatted.replace(
    /([.!?])\s+((?!For\s)(?:[A-Z][a-z]+\s+){1,3}(?:\([A-Z]+\)\s*)?[A-Za-z]*)\s*:/g,
    '$1\n\n### $2\n\n'
  );
  formatted = formatted.replace(
    /([.!?])\s+(For\s+[^:]+)\s*:/g,
    '$1\n\n- **$2**:'
  );
  return formatted.trim();
}

/** Round percentage array to sum to exactly 100 */
export function roundToHundred(items: { key: string; value: number }[]): Map<string, number> {
  const total = items.reduce((sum, it) => sum + it.value, 0);
  if (total === 0) return new Map(items.map(it => [it.key, 0]));
  const rawPcts = items.map(it => ({
    key: it.key,
    raw: (it.value / total) * 100,
    floored: Math.floor((it.value / total) * 100),
    remainder: ((it.value / total) * 100) % 1,
  }));
  const flooredSum = rawPcts.reduce((sum, p) => sum + p.floored, 0);
  let deficit = 100 - flooredSum;
  const sorted = [...rawPcts].sort((a, b) => b.remainder - a.remainder);
  for (const item of sorted) {
    if (deficit <= 0) break;
    item.floored += 1;
    deficit--;
  }
  return new Map(rawPcts.map(p => [p.key, p.floored]));
}
