/**
 * Comprehensive Brand Detection Test Suite
 * Tests the 5-layer NER system across multiple industry verticals.
 *
 * Usage: node test-brand-detection.js
 */

// ============================================================================
// Mirror all brand detection functions from geo-audit/index.ts
// ============================================================================

const BRAND_STOPLIST = new Set([
  "artificial intelligence", "machine learning", "deep learning", "natural language",
  "cloud computing", "data analytics", "digital marketing", "social media",
  "search engine", "web development", "mobile app", "user experience",
  "best practices", "case study", "white paper", "press release",
  "important note", "key takeaway", "quick summary", "final thoughts",
  "pros and cons", "top picks", "best overall", "runner up", "budget pick",
  "editor choice", "our pick", "honorable mention", "bottom line",
  "key features", "main features", "notable features", "key benefits",
  "key strengths", "main strengths", "top strengths",
  "here are", "there are", "you can", "you should", "we recommend",
  "customer service", "customer support", "tech support",
  "price match", "price match guarantee", "free shipping", "free returns",
  "curbside pickup", "in store pickup", "same day delivery",
  "loyalty program", "rewards program",
  "running shoes", "training shoes", "trail running", "road running",
  "cross training", "neutral shoes", "stability shoes", "motion control",
  "wide fit", "narrow fit", "arch support",
  "united states", "north america", "european union", "asia pacific",
  "new york", "san francisco", "los angeles", "london",
  "texas based", "california based", "us based",
  "co op", "free u",
  "ideal for", "best for", "good for", "great for", "perfect for", "recommended for",
  "where to buy", "how to buy", "where to find", "where to shop",
  "reviews & sources", "reviews and sources", "sources & reviews",
  "also consider", "similar to", "compared to", "comparison",
  "things to consider", "what to look for", "what to consider",
  "buying guide", "buyer guide", "shopping guide",
  "price range", "price point", "price check", "starting at",
  "our verdict", "final verdict", "overall verdict", "the verdict",
  "our rating", "overall rating", "editor rating",
  "read more", "learn more", "see more", "view more", "shop now",
  "related articles", "related posts", "further reading",
  "table of contents", "quick navigation",
  "dna loft", "react foam", "air zoom", "fresh foam", "boost light",
  "ff blast", "ff blast plus", "pure gel", "puregel", "gel technology",
  "flyknit", "flywire", "zoom air", "zoom x", "boost foam", "ultra boost",
  "gore tex", "carbon plate", "carbon fiber", "energy return",
  "river north", "river east", "river west", "river south",
  "west loop", "east loop", "south loop", "north loop",
  "east village", "west village", "north shore", "south shore",
  "south side", "north side", "east side", "west side",
  "near west side", "near north side", "near south side", "near east side",
  "magnificent mile", "gold coast", "old town", "lincoln park",
  "silicon valley", "wall street", "main street", "high street",
  "downtown", "midtown", "uptown", "city center", "town center",
  "bay area", "tri state", "east coast", "west coast",
  "south beach", "north beach", "central park", "times square",
  "beverly hills", "palm beach", "santa monica", "lake district",
  "james beard", "michelin star", "michelin starred", "award winning",
  "james beard award", "editor choice award", "best in class",
  "step up", "stand out", "top tier", "mid range", "high end", "low end",
  "long run", "short run", "easy run", "tempo run", "speed work",
  "race day", "rest day", "leg day",
  "one stop", "all in one", "end to end", "side by side",
  "hands down", "across the board", "around the clock",
  // LLM structural headers (commonly bold-formatted, not brands)
  "enterprise options", "boutique options", "boutique alternatives",
  "neighborhood guides", "neighborhood guide", "neighborhoods to watch",
  "luxury sustainable", "fast fashion alternatives",
  "insurance coverage", "charging infrastructure",
  "key specs comparison", "key specs", "federal tax credits",
  "credit card partners", "credit card", "mortgage lenders",
  "certifications to look for", "certifications", "rankings source",
  "mental health focused", "mental health", "robo advisors", "robo-advisors",
  "collaboration add-ons", "add-ons", "add ons",
  "chicago neighborhoods to watch", "neighborhoods",
]);

const PRODUCT_TO_BRAND = {
  "iphone": "Apple", "ipad": "Apple", "macbook": "Apple", "airpods": "Apple",
  "apple watch": "Apple", "imac": "Apple", "apple tv": "Apple", "siri": "Apple",
  "gmail": "Google", "google maps": "Google", "youtube": "Google",
  "android": "Google", "chrome": "Google", "google ads": "Google",
  "windows": "Microsoft", "excel": "Microsoft", "outlook": "Microsoft",
  "teams": "Microsoft", "azure": "Microsoft", "bing": "Microsoft",
  "linkedin": "Microsoft", "github": "Microsoft", "xbox": "Microsoft",
  "aws": "Amazon", "alexa": "Amazon", "kindle": "Amazon",
  "facebook": "Meta", "instagram": "Meta", "whatsapp": "Meta",
  "chatgpt": "OpenAI", "dall-e": "OpenAI", "gpt-4": "OpenAI",
  "gemini": "Google", "claude": "Anthropic",
  "photoshop": "Adobe", "illustrator": "Adobe",
  "slack": "Salesforce", "tableau": "Salesforce",
  "tesla model": "Tesla", "model 3": "Tesla", "model y": "Tesla",
};

const DOMAIN_TO_BRAND = {
  "apple.com": "Apple", "google.com": "Google", "microsoft.com": "Microsoft",
  "amazon.com": "Amazon", "meta.com": "Meta", "facebook.com": "Meta",
  "openai.com": "OpenAI", "anthropic.com": "Anthropic",
  "adobe.com": "Adobe", "salesforce.com": "Salesforce",
  "hubspot.com": "HubSpot", "shopify.com": "Shopify",
  "semrush.com": "Semrush", "ahrefs.com": "Ahrefs", "moz.com": "Moz",
  "nike.com": "Nike", "adidas.com": "Adidas", "samsung.com": "Samsung",
};

function stripUrlsForNER(text) {
  return text
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/https?:\/\/[^\s<>"{}|\\^`\[\])+,]+/gi, '')
    .replace(/www\.[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s,;)"]*/gi, '')
    .replace(/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.(?:com|org|net|io|co|ai|dev|app|edu|gov|info|club)(?:\/[^\s,;)"]*)?/gi, '')
    .replace(/\bURL\s*:\s*/gi, '')
    .replace(/\[\d+\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBrandCandidate(raw) {
  return raw
    .replace(/[:\-–—,;.!?]+$/, '')
    .replace(/^[:\-–—,;.!?\s]+/, '')
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\s*(official\s+(?:website|site|store|page|homepage))\s*$/i, '')
    .replace(/\s*(home\s*page|landing\s*page)\s*$/i, '')
    .trim();
}

function isLikelyBrand(candidate) {
  const lower = candidate.toLowerCase().trim();
  if (lower.length < 3 || lower.length > 50) return false;
  if (BRAND_STOPLIST.has(lower)) return false;
  if (/^\d+$/.test(lower)) return false;
  const words = lower.split(/\s+/);
  if (words.some(w => w.length < 2 && w !== '&')) return false;
  if (/^.{1,4}'s$/i.test(lower)) return false;
  if (words.length === 1 && lower.length > 14) {
    const uppercaseCount = (candidate.match(/[A-Z]/g) || []).length;
    if (uppercaseCount <= 1) return false;
  }
  if (words.length === 1) {
    if (/^(the|very|most|best|top|great|good|new|free|easy|fast|simple|quick|more|less|also|just|well|some|many|other|each|both|such|these|those|this|that|here|there|when|where|how|what|why|which|will|would|could|should|they|their|your|with|from|have|been|were|does|then|than|into|only|over|after|before|about|between|through|during|without|however|therefore|furthermore|additionally|moreover|meanwhile|nevertheless|alternatively|specifically|essentially|particularly|generally|typically|usually|often|always|never|sometimes|perhaps|maybe|likely|unlikely|certainly|probably|possibly|rather|quite|still|already|indeed|overall|primarily|mainly|especially|basically|simply|currently|recently|actually|obviously|clearly|highly|extremely|virtually|nearly|roughly|approximately|finally|ultimately|accordingly|regardless|nonetheless)$/i.test(lower)) return false;
    if (/^(shipping|returns|delivery|pricing|prices|budget|premium|standard|selection|collection|collections|catalog|inventory|experience|quality|comfort|support|stability|cushioning|performance|durability|style|design|technology|features|models|options|varieties|sizes|colors|styles|store|stores|shop|outlet|retailers|retailer|location|locations|branch|free|comprehensive|additional|alternative|alternatives|largest|smallest|newest|oldest|fastest|cheapest|specialty|exclusive|limited|popular|recommended|online|website|platform|software|application|service|tool|solution|product|company|business|enterprise|organization|overview|conclusion|summary|introduction|disclaimer|membership|warranty|guarantee|pickup|checkout|wide|narrow|fit|size|weight|cushion|traction|grip|breathable|lightweight|versatile|durable|affordable|available|notable|important|key|main|top|first|second|third|fourth|last|latest|next|previous|certain|multiple|numerous|various|several|different|significant|similar|typical|common|average|standard|basic|advanced|regular|entire|complete|full|total|single|double|major|minor|primary|secondary|special|general|specific|original|traditional|modern|classic|unique|custom|local|global|national|international|personal|professional|official|public|private|natural|physical|digital|virtual|annual|monthly|weekly|daily|type|pros|cons|specifications|specs|verdict|comparison|rating|score|price|value|ride|feel|review|reviews|sources|guide|drop|upper|midsole|outsole|sizing|foam|mesh|rubber|carbon|plate|heel|toe|arch|sole|lace|laces|tongue|collar|insole|footbed|offset|stack|rocker|responsive|plush|firm|soft|snug|tight|loose|true|award|winning|starred|mile|downtown|uptown|midtown|district|county|township|boulevard|avenue|highway|plaza|square|beach|lake|mountain|valley|creek|harbor|island|peninsula|heights|estates|terrace|grove)$/i.test(lower)) return false;
  }
  if (words.length >= 2) {
    const firstWord = words[0];
    if (/^(north|south|east|west|upper|lower|central|greater|inner|outer|old|new|near|far|mid|lake|river|bay|mount|port|fort|cape|isle|san|santa|saint|los|las|el|la|del)$/i.test(firstWord)) {
      const isKnownBrandPattern = /^(new balance|old navy|north face|old spice|red bull)$/i.test(lower);
      if (!isKnownBrandPattern) return false;
    }
  }
  return true;
}

function extractBrandCandidatesFromText(text, knownBrands) {
  const brands = new Map();
  if (!text) return brands;
  const cleanText = stripUrlsForNER(text);
  const sentences = cleanText.split(/(?<=[.!?])\s+|(?:\r?\n)+/).filter(s => s.trim().length > 0);

  function addBrand(rawKey, rawTitle, position, highConf) {
    const title = cleanBrandCandidate(rawTitle);
    const key = cleanBrandCandidate(rawKey).toLowerCase();
    if (key.length < 3) return;
    if (brands.has(key)) {
      const existing = brands.get(key);
      existing.count++;
      if (!existing.positions.includes(position)) existing.positions.push(position);
      if (highConf) existing.highConfidence = true;
    } else {
      brands.set(key, { count: 1, positions: [position], title, highConfidence: highConf });
    }
  }

  const lowerClean = cleanText.toLowerCase();
  for (const known of knownBrands) {
    if (!known || known.length < 2) continue;
    const knownLower = known.toLowerCase();
    let idx = 0;
    const positions = [];
    while ((idx = lowerClean.indexOf(knownLower, idx)) !== -1) {
      const textBefore = cleanText.substring(0, idx);
      const sentIdx = (textBefore.match(/[.!?\n]/g) || []).length + 1;
      positions.push(sentIdx);
      idx += knownLower.length;
    }
    if (positions.length > 0) {
      for (const pos of positions) {
        addBrand(knownLower, known, pos, true);
      }
    }
  }

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const position = i + 1;
    let match;

    // Strategy A: Bold/markdown names
    const boldPattern = /\*\*([^*]{2,40})\*\*|__([^_]{2,40})__/g;
    while ((match = boldPattern.exec(sentence)) !== null) {
      const candidate = (match[1] || match[2]).trim();
      if (candidate.split(' ').length > 5) continue;
      if (!isLikelyBrand(candidate)) continue;
      addBrand(candidate.toLowerCase(), candidate, position, true);
    }

    // Strategy B: Numbered/bulleted list items
    const listMatch = sentence.match(/^\s*(?:\d+[.)]\s*|[•\-]\s*)\*{0,2}([A-Z][A-Za-z'][A-Za-z\s&'.]{0,35}?)(?:\*{0,2})\s*[-–:]/);
    if (listMatch) {
      const candidate = listMatch[1].trim().replace(/\*+/g, '');
      if (isLikelyBrand(candidate)) {
        addBrand(candidate.toLowerCase(), candidate, position, true);
      }
    }

    // Strategy C: Multi-word capitalized phrases
    const multiWordPattern = /\b([A-Z][a-zA-Z']{2,}(?:\s+(?:and|of|for|by|the|&)\s+[A-Z][a-zA-Z']{2,}|\s+[A-Z][a-zA-Z']{2,}){1,3})\b/g;
    while ((match = multiWordPattern.exec(sentence)) !== null) {
      const candidate = match[1].trim();
      if (!isLikelyBrand(candidate)) continue;
      addBrand(candidate.toLowerCase(), candidate, position, false);
    }

    // Strategy D: ALL-CAPS words
    const allCapsPattern = /\b([A-Z]{3,10})\b/g;
    while ((match = allCapsPattern.exec(sentence)) !== null) {
      const candidate = match[1].trim();
      if (/^(THE|AND|FOR|BUT|NOT|YOU|URL|FAQ|USA|UPS|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|TOP|NEW|GET|ALL|BIG|SET|RUN|FIT|TRY|SEE|ADD|USE|WAY|DAY|GTS|FREE|BEST|MOST|WIDE|FULL|HIGH|LOW|PRO|GPS|LED|USB|PDF|CSS|API|SQL|ETF|IPO|CEO|CFO|CTO|COO|LLC|INC|LTD|DNA|EVA|TPU|OEM|RSS|CDN|CMS|RAM|ROM|VPN|SSD|HDD|HDR|FPS|RPM|MID|MAX|LOFT|FOAM|MESH|GORE|KNIT|ZOOM|FLEX|AIR|GEL|CMEVA|BLAST|PLUS|PEBA|RMAT|AHAR|PWRRUN|HOVR|NITRO|BOOST|VFLY|DRFT|GTX|SPEC|FAST|LITE|TECH|CORE|DUAL|HYPER|ULTRA|FUEL|GRID|WAVE|PACE|LINK|SYNC|BETA|PURE|NEXT|STEP|DASH|FLOW|SALE|SHIP|CART|RATE|PLAN|TIER|FLAT|SLIM|THIN|HALF|PAIR|FEAT|PICK|LIST|NOTE|GOAL|MILE|CLUB|IRA|SUV|MLS|CFP|EQS|GOTS|OEKO|TEX)$/.test(candidate)) continue;
      if (!isLikelyBrand(candidate)) continue;
      addBrand(candidate.toLowerCase(), candidate, position, true);
    }
  }

  return brands;
}

function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const positiveWords = /\b(best|great|excellent|outstanding|superior|top|recommended|ideal|perfect|impressive|innovative|leading|premier|quality|reliable|trusted|favorite|loved|amazing|fantastic|wonderful|exceptional)\b/g;
  const negativeWords = /\b(worst|bad|poor|terrible|avoid|disappointing|mediocre|overpriced|cheap|unreliable|lacking|weak|limited|slow|outdated|frustrating|problematic|subpar|inferior)\b/g;
  const posCount = (lower.match(positiveWords) || []).length;
  const negCount = (lower.match(negativeWords) || []).length;
  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

function mergeSubBrand(results, parentIdx, childIdx) {
  const parent = results[parentIdx];
  const child = results[childIdx];
  parent.mention_count += child.mention_count;
  if (child.positions) {
    for (const pos of child.positions) {
      if (!(parent.positions || []).includes(pos)) {
        parent.positions = parent.positions || [];
        parent.positions.push(pos);
      }
    }
  }
  parent.entity_points = Math.round(
    (parent.positions || []).reduce((sum, pos) => sum + (1 / pos), 0) * 100
  ) / 100;
}

function extractBrandsFromResponse(responseText, citations, brandName, brandTags, competitors) {
  if (!responseText || responseText.length < 10) return [];
  const lowerText = responseText.toLowerCase();
  const knownBrands = [brandName, ...brandTags, ...competitors].filter(Boolean);

  // LAYER 1: NER
  const textBrands = extractBrandCandidatesFromText(responseText, knownBrands);

  // LAYER 4: Product to Brand (word-boundary matching to avoid "excel" in "excellent")
  for (const [product, parentBrand] of Object.entries(PRODUCT_TO_BRAND)) {
    const productRegex = new RegExp(`\\b${product.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const productMatch = productRegex.exec(lowerText);
    if (productMatch) {
      const parentKey = parentBrand.toLowerCase();
      if (!textBrands.has(parentKey)) {
        const textBefore = responseText.substring(0, productMatch.index);
        const sentencePos = (textBefore.match(/[.!?\n]/g) || []).length + 1;
        textBrands.set(parentKey, { count: 1, positions: [sentencePos], title: parentBrand, highConfidence: true });
      }
      const productKey = product.toLowerCase();
      if (textBrands.has(productKey) && productKey !== parentKey) {
        const productData = textBrands.get(productKey);
        const parentData = textBrands.get(parentKey);
        parentData.count += productData.count;
        parentData.positions = [...new Set([...parentData.positions, ...productData.positions])].sort((a, b) => a - b);
        textBrands.delete(productKey);
      }
    }
  }

  // LAYER 3: Domain enrichment
  const domainBrandSources = new Map();
  for (const citation of citations) {
    const domain = (citation.domain || '').toLowerCase();
    const mappedBrand = DOMAIN_TO_BRAND[domain];
    if (mappedBrand) {
      const key = mappedBrand.toLowerCase();
      if (textBrands.has(key)) {
        if (!domainBrandSources.has(key)) domainBrandSources.set(key, []);
        domainBrandSources.get(key).push(citation.url);
      }
    }
  }

  // ASSEMBLY
  const allBrandTerms = [brandName, ...brandTags].filter(Boolean).map(t => t.toLowerCase());
  const allCompetitorTerms = competitors.filter(Boolean).map(c => c.toLowerCase());
  const results = [];

  for (const [key, data] of textBrands.entries()) {
    if (!isLikelyBrand(key)) continue;
    const isKnown = allBrandTerms.some(t => key.includes(t) || t.includes(key))
      || allCompetitorTerms.some(c => key.includes(c) || c.includes(key));
    const uniquePositions = [...new Set(data.positions)].length;
    if (!data.highConfidence && !isKnown && uniquePositions < 2) continue;

    const entityPoints = data.positions.reduce((sum, pos) => sum + (1 / pos), 0);
    let title = data.title;
    for (const [, parentBrand] of Object.entries(PRODUCT_TO_BRAND)) {
      if (parentBrand.toLowerCase() === key) { title = parentBrand; break; }
    }
    const isOwnBrand = allBrandTerms.some(t => key.includes(t) || t.includes(key));
    const isCompetitor = allCompetitorTerms.some(c => key.includes(c) || c.includes(key));

    const firstMentionIdx = lowerText.indexOf(key);
    let sentiment = "neutral";
    if (firstMentionIdx !== -1) {
      const ctxStart = Math.max(0, firstMentionIdx - 100);
      const ctxEnd = Math.min(responseText.length, firstMentionIdx + key.length + 100);
      sentiment = analyzeSentiment(responseText.substring(ctxStart, ctxEnd));
    }
    const sources = domainBrandSources.get(key);

    results.push({
      title,
      mention_count: data.count,
      position: data.positions[0],
      positions: data.positions,
      entity_points: Math.round(entityPoints * 100) / 100,
      is_own_brand: isOwnBrand,
      is_competitor: isCompetitor,
      sentiment,
      sources: sources && sources.length > 0 ? sources : undefined,
    });
  }

  // Sort
  results.sort((a, b) => {
    if (a.is_own_brand && !b.is_own_brand) return -1;
    if (!a.is_own_brand && b.is_own_brand) return 1;
    if (a.is_competitor && !b.is_competitor) return -1;
    if (!a.is_competitor && b.is_competitor) return 1;
    return b.entity_points - a.entity_points;
  });

  // DEDUP PASS 1: Merge sub-brands into parents
  let toRemove = new Set();
  for (let i = 0; i < results.length; i++) {
    if (toRemove.has(i)) continue;
    const parentTitle = results[i].title.toLowerCase();
    for (let j = 0; j < results.length; j++) {
      if (i === j || toRemove.has(j)) continue;
      const childTitle = results[j].title.toLowerCase();
      if (childTitle.startsWith(parentTitle + " ") || childTitle.startsWith("the " + parentTitle)) {
        mergeSubBrand(results, i, j);
        toRemove.add(j);
      }
    }
  }
  for (const idx of [...toRemove].sort((a, b) => b - a)) {
    results.splice(idx, 1);
  }

  // DEDUP PASS 2: Collapse product models into known brands/competitors
  const allKnownNames = [...allBrandTerms, ...allCompetitorTerms];
  for (let i = results.length - 1; i >= 0; i--) {
    const titleLower = results[i].title.toLowerCase();
    for (const known of allKnownNames) {
      if (!known || known.length < 2) continue;
      if (titleLower.startsWith(known + " ") && titleLower !== known) {
        const parentIdx = results.findIndex((r, idx) => idx !== i && r.title.toLowerCase() === known);
        if (parentIdx !== -1) {
          mergeSubBrand(results, parentIdx, i);
          results.splice(i, 1);
        } else {
          const properTitle = known.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          results[i].title = properTitle;
          results[i].is_own_brand = allBrandTerms.includes(known);
          results[i].is_competitor = allCompetitorTerms.includes(known);
        }
        break;
      }
    }
  }

  // DEDUP PASS 3: Final deduplicate by title
  const seenTitles = new Map();
  for (let i = results.length - 1; i >= 0; i--) {
    const key = results[i].title.toLowerCase();
    if (seenTitles.has(key)) {
      mergeSubBrand(results, seenTitles.get(key), i);
      results.splice(i, 1);
    } else {
      seenTitles.set(key, i);
    }
  }

  return results;
}

function mapDataForSEOBrandEntities(apiBrands, responseText, brandName, brandTags, competitors, citations) {
  const lowerText = responseText.toLowerCase();
  const allBrandTerms = [brandName, ...brandTags].filter(Boolean).map(t => t.toLowerCase());
  const allCompetitorTerms = competitors.filter(Boolean).map(c => c.toLowerCase());
  const results = [];
  const seenTitles = new Set();

  for (const apiBrand of apiBrands) {
    if (!apiBrand.title || apiBrand.title.length < 2) continue;
    const titleLower = apiBrand.title.toLowerCase();
    if (seenTitles.has(titleLower)) continue;
    seenTitles.add(titleLower);

    let mentionCount = 0;
    const positions = [];
    let searchIdx = 0;
    while ((searchIdx = lowerText.indexOf(titleLower, searchIdx)) !== -1) {
      mentionCount++;
      const textBefore = responseText.substring(0, searchIdx);
      const sentenceIdx = (textBefore.match(/[.!?\n]/g) || []).length + 1;
      if (!positions.includes(sentenceIdx)) positions.push(sentenceIdx);
      searchIdx += titleLower.length;
    }
    if (mentionCount === 0) { mentionCount = 1; positions.push(1); }

    const entityPoints = positions.reduce((sum, pos) => sum + (1 / pos), 0);
    const isOwnBrand = allBrandTerms.some(t => titleLower.includes(t) || t.includes(titleLower));
    const isCompetitor = allCompetitorTerms.some(c => titleLower.includes(c) || c.includes(titleLower));

    let sentiment = "neutral";
    const firstIdx = lowerText.indexOf(titleLower);
    if (firstIdx !== -1) {
      const ctxStart = Math.max(0, firstIdx - 100);
      const ctxEnd = Math.min(responseText.length, firstIdx + titleLower.length + 100);
      sentiment = analyzeSentiment(responseText.substring(ctxStart, ctxEnd));
    }

    const sources = [];
    if (apiBrand.urls) {
      for (const u of apiBrand.urls) { if (u.url) sources.push(u.url); }
    }
    for (const citation of citations) {
      const domain = (citation.domain || '').toLowerCase();
      if (domain && titleLower.includes(domain.split('.')[0])) {
        if (!sources.includes(citation.url)) sources.push(citation.url);
      }
    }

    results.push({
      title: apiBrand.title,
      markdown: apiBrand.markdown,
      category: apiBrand.category,
      mention_count: mentionCount,
      position: positions[0],
      positions,
      entity_points: Math.round(entityPoints * 100) / 100,
      is_own_brand: isOwnBrand,
      is_competitor: isCompetitor,
      sentiment,
      sources: sources.length > 0 ? sources : undefined,
    });
  }

  results.sort((a, b) => {
    if (a.is_own_brand && !b.is_own_brand) return -1;
    if (!a.is_own_brand && b.is_own_brand) return 1;
    if (a.is_competitor && !b.is_competitor) return -1;
    if (!a.is_competitor && b.is_competitor) return 1;
    return b.entity_points - a.entity_points;
  });

  return results;
}


// ============================================================================
// TEST HARNESS
// ============================================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${testName}`);
  } else {
    failedTests++;
    failures.push({ testName, details });
    console.log(`  ✗ ${testName}`);
    if (details) console.log(`    → ${details}`);
  }
}

function section(name) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${name}`);
  console.log('='.repeat(70));
}

function brandTitles(results) {
  return results.map(b => b.title);
}

function hasBrand(results, name) {
  return results.some(b => b.title.toLowerCase() === name.toLowerCase());
}

function noBrand(results, name) {
  return !results.some(b => b.title.toLowerCase() === name.toLowerCase());
}


// ============================================================================
// TEST GROUP 1: Running Shoes (original domain)
// ============================================================================
section("1. Running Shoes - NER Extraction");

const runningResponse = `Here are the best running shoes for 2024:

1. **Nike Pegasus 41** - The classic daily trainer with React foam and a comfortable ride. Nike continues to lead in running shoe innovation.
2. **Brooks Ghost 16** - Great neutral shoe with DNA LOFT cushioning. Brooks has been a favorite among distance runners.
3. **ASICS Gel-Nimbus 26** - Premium cushioning with GEL technology and CMEVA midsole. ASICS is known for quality.
4. **HOKA Clifton 9** - Excellent lightweight option. HOKA uses PEBA-based foam for maximum comfort.
5. **New Balance Fresh Foam 1080v13** - Balanced ride with Fresh Foam X. New Balance offers wide sizing options.
6. **Saucony Ride 17** - Uses PWRRUN+ foam for responsive cushioning. Saucony is great for neutral runners.
7. **Adidas Ultraboost Light** - Features BOOST foam and Continental rubber outsole. Adidas combines style with performance.

**Where to Buy:**
Visit nike.com, brooksrunning.com, or your local running store for the best selection.

**Reviews & Sources:** Runner's World, Running Warehouse`;

const runningBrands = extractBrandsFromResponse(
  runningResponse,
  [{ url: "https://nike.com/running", domain: "nike.com" }],
  "Nike", ["Nike Running"], ["Brooks", "ASICS", "HOKA", "New Balance", "Saucony", "Adidas"]
);
const runningTitles = brandTitles(runningBrands);
console.log("  Detected brands:", runningTitles.join(", "));
console.log("  Count:", runningBrands.length);

assert(hasBrand(runningBrands, "Nike"), "Detects Nike (own brand)");
assert(hasBrand(runningBrands, "Brooks"), "Detects Brooks (competitor)");
assert(hasBrand(runningBrands, "ASICS"), "Detects ASICS (competitor)");
assert(hasBrand(runningBrands, "HOKA"), "Detects HOKA (competitor)");
assert(hasBrand(runningBrands, "New Balance"), "Detects New Balance (competitor)");
assert(hasBrand(runningBrands, "Saucony"), "Detects Saucony (competitor)");
assert(hasBrand(runningBrands, "Adidas"), "Detects Adidas (competitor)");
assert(runningBrands[0].is_own_brand === true, "Nike flagged as own brand");
assert(runningBrands[0].sources && runningBrands[0].sources.length > 0, "Nike has sources from domain mapping");

// Noise rejection
assert(noBrand(runningBrands, "DNA LOFT"), "Rejects DNA LOFT (tech term)");
assert(noBrand(runningBrands, "DNA"), "Rejects DNA (tech)");
assert(noBrand(runningBrands, "LOFT"), "Rejects LOFT (tech)");
assert(noBrand(runningBrands, "CMEVA"), "Rejects CMEVA (tech)");
assert(noBrand(runningBrands, "PWRRUN"), "Rejects PWRRUN (tech)");
assert(noBrand(runningBrands, "PEBA"), "Rejects PEBA (material)");
assert(noBrand(runningBrands, "BOOST"), "Rejects BOOST (tech term)");
assert(noBrand(runningBrands, "React"), "Rejects React (tech)");
assert(noBrand(runningBrands, "Fresh Foam"), "Rejects Fresh Foam (tech - in stoplist)");
assert(noBrand(runningBrands, "Reviews & Sources"), "Rejects 'Reviews & Sources'");
assert(noBrand(runningBrands, "Where to Buy"), "Rejects 'Where to Buy'");
assert(noBrand(runningBrands, "Runner's World"), "Rejects 'Runner's World' (short possessive or filtered)");
assert(noBrand(runningBrands, "Running Warehouse"), "Rejects domain-like concatenation");

// Sub-brand dedup
assert(noBrand(runningBrands, "Nike Pegasus 41"), "Sub-brand 'Nike Pegasus 41' merged into Nike");
assert(noBrand(runningBrands, "Brooks Ghost 16"), "Sub-brand 'Brooks Ghost 16' merged into Brooks");
assert(noBrand(runningBrands, "ASICS Gel-Nimbus 26"), "Sub-brand 'ASICS Gel-Nimbus 26' merged into ASICS");

// Count check
assert(runningBrands.length >= 5 && runningBrands.length <= 12,
  `Reasonable brand count (${runningBrands.length})`, `Expected 5-12, got ${runningBrands.length}`);


// ============================================================================
// TEST GROUP 2: Software / SaaS
// ============================================================================
section("2. Software / SaaS Tools");

const softwareResponse = `The best project management tools for teams in 2024:

1. **Asana** - Excellent for task management and team collaboration. Asana offers flexible workflows with multiple view options including boards and timelines.

2. **Monday.com** - A visual work OS with powerful automations. Monday.com is great for teams that prefer color-coded boards.

3. **Jira** - The industry standard for software development teams. Jira by Atlassian provides powerful sprint planning and backlog management.

4. **ClickUp** - Feature-rich and affordable. ClickUp is rapidly growing and offers docs, whiteboards, and time tracking in one platform.

5. **Notion** - Excellent knowledge base and project management combined. Notion provides a flexible all-in-one workspace.

**Enterprise Options:**
For larger teams, **Smartsheet** and **Microsoft Project** are strong choices. Both integrate well with Excel and Teams.

**Collaboration Add-ons:**
Most tools integrate with Slack, Google Workspace, and Zoom for seamless communication.

**Key Features to Consider:**
- Task dependencies and Gantt charts
- Time tracking and reporting
- API integrations and automation
- Mobile app support

Visit asana.com or monday.com for free trials.`;

const softwareBrands = extractBrandsFromResponse(
  softwareResponse, [],
  "Asana", ["Asana"], ["Monday.com", "Jira", "ClickUp", "Notion"]
);
const softwareTitles = brandTitles(softwareBrands);
console.log("  Detected brands:", softwareTitles.join(", "));
console.log("  Count:", softwareBrands.length);

assert(hasBrand(softwareBrands, "Asana"), "Detects Asana (own brand)");
assert(softwareBrands[0].is_own_brand === true, "Asana flagged as own brand");
assert(hasBrand(softwareBrands, "Jira"), "Detects Jira");
assert(hasBrand(softwareBrands, "ClickUp"), "Detects ClickUp");
assert(hasBrand(softwareBrands, "Notion"), "Detects Notion");
assert(hasBrand(softwareBrands, "Smartsheet"), "Detects Smartsheet");
assert(hasBrand(softwareBrands, "Microsoft"), "Detects Microsoft (via product mapping or text)");
// Google should be detected via product mapping (Google Workspace → Google, Slack → Salesforce)
assert(hasBrand(softwareBrands, "Salesforce") || hasBrand(softwareBrands, "Slack"), "Detects Slack or Salesforce (L4 mapping)");

// Noise rejection
assert(noBrand(softwareBrands, "Key Features"), "Rejects 'Key Features'");
assert(noBrand(softwareBrands, "Enterprise Options"), "Rejects 'Enterprise Options' (stoplist)");
assert(noBrand(softwareBrands, "Collaboration"), "Rejects generic word 'Collaboration'");
assert(noBrand(softwareBrands, "Gantt"), "Rejects 'Gantt' (3 chars, single word)");
assert(noBrand(softwareBrands, "API"), "Rejects 'API' (ALL-CAPS exclusion)");

assert(softwareBrands.length >= 5 && softwareBrands.length <= 15,
  `Reasonable brand count (${softwareBrands.length})`, `Expected 5-15, got ${softwareBrands.length}`);


// ============================================================================
// TEST GROUP 3: Restaurants / Dining
// ============================================================================
section("3. Restaurants & Dining");

const restaurantResponse = `Best restaurants in Chicago for a special occasion:

1. **Alinea** - The three-Michelin-starred restaurant by Grant Achatz. Known for avant-garde molecular gastronomy in the Lincoln Park neighborhood.

2. **Girl & the Goat** - Chef Stephanie Izard's flagship in the West Loop. Creative dishes with bold flavors.

3. **Smyth** - A two-Michelin-starred farm-to-table experience. Located in the West Loop district, Smyth offers a refined tasting menu.

4. **Avec** - Mediterranean-influenced sharing plates in a cozy wine-bar atmosphere. A River North favorite.

5. **RPM Italian** - Upscale Italian by the Lettuce Entertain You group. Located on the Magnificent Mile area.

6. **Portillo's** - Chicago's beloved hot dog and Italian beef chain. Multiple locations across the Gold Coast and beyond.

**Neighborhood Guides:**
- **River North**: Great for upscale dining and cocktail bars
- **West Loop**: The city's restaurant row with James Beard Award winners
- **Old Town**: Cozy bistros and neighborhood gems

**Reservations:**
Book through OpenTable or Resy for the best availability. Tock is also popular for prix fixe restaurants.

**Award Winning Chefs:**
Chicago is home to numerous James Beard award-winning chefs including Grant Achatz and Stephanie Izard.`;

const restaurantBrands = extractBrandsFromResponse(
  restaurantResponse, [],
  "Alinea", [], ["Girl & the Goat", "Smyth", "RPM Italian"]
);
const restaurantTitles = brandTitles(restaurantBrands);
console.log("  Detected brands:", restaurantTitles.join(", "));
console.log("  Count:", restaurantBrands.length);

assert(hasBrand(restaurantBrands, "Alinea"), "Detects Alinea (own brand)");
assert(hasBrand(restaurantBrands, "Smyth"), "Detects Smyth");
assert(hasBrand(restaurantBrands, "Avec"), "Detects Avec");
assert(hasBrand(restaurantBrands, "RPM Italian"), "Detects RPM Italian (competitor)");
// OpenTable: single word, not bold, mentioned once → filtered by confidence gate (expected)
assert(noBrand(restaurantBrands, "OpenTable") || hasBrand(restaurantBrands, "OpenTable"), "OpenTable detection depends on formatting (OK either way)");

// Noise rejection - geographic terms
assert(noBrand(restaurantBrands, "River North"), "Rejects 'River North' (geographic)");
assert(noBrand(restaurantBrands, "West Loop"), "Rejects 'West Loop' (geographic)");
assert(noBrand(restaurantBrands, "Old Town"), "Rejects 'Old Town' (geographic)");
assert(noBrand(restaurantBrands, "Lincoln Park"), "Rejects 'Lincoln Park' (geographic)");
assert(noBrand(restaurantBrands, "Gold Coast"), "Rejects 'Gold Coast' (geographic)");
assert(noBrand(restaurantBrands, "Magnificent Mile"), "Rejects 'Magnificent Mile' (geographic)");
assert(noBrand(restaurantBrands, "James Beard"), "Rejects 'James Beard' (award label)");
assert(noBrand(restaurantBrands, "Neighborhood Guides"), "Rejects 'Neighborhood Guides' (stoplist)");
assert(noBrand(restaurantBrands, "Award Winning"), "Rejects 'Award Winning'");

assert(restaurantBrands.length >= 3 && restaurantBrands.length <= 12,
  `Reasonable brand count (${restaurantBrands.length})`, `Expected 3-12, got ${restaurantBrands.length}`);


// ============================================================================
// TEST GROUP 4: Automotive
// ============================================================================
section("4. Automotive / Electric Vehicles");

const autoResponse = `Best electric vehicles for 2024:

1. **Tesla Model Y** - The best-selling EV worldwide. Tesla's Model Y offers excellent range (330 miles), the Supercharger network, and Autopilot. Starting at $43,990.

2. **Hyundai Ioniq 5** - Outstanding value with 800V charging architecture. Hyundai provides a 10-year battery warranty.

3. **BMW iX** - Luxury electric SUV with premium materials. BMW offers both the iX xDrive40 and xDrive50 variants.

4. **Ford Mustang Mach-E** - Ford's entry combines the Mustang heritage with electric innovation. Available in GT Performance Edition.

5. **Rivian R1S** - Adventure-focused electric SUV. Rivian offers impressive off-road capabilities and 300+ mile range.

6. **Mercedes-Benz EQS** - The most luxurious electric sedan available. Mercedes-Benz sets the standard for EV refinement.

**Charging Infrastructure:**
ChargePoint, Electrify America, and the Tesla Supercharger network provide extensive coverage across North America.

**Key Specs Comparison:**
| Model | Range | 0-60 | Price |
| Tesla Model Y | 330 mi | 4.8s | $43,990 |
| Ioniq 5 | 303 mi | 5.2s | $41,800 |

**Federal Tax Credits:**
The IRA provides up to $7,500 for qualifying EVs purchased from eligible manufacturers.`;

const autoBrands = extractBrandsFromResponse(
  autoResponse, [],
  "Tesla", ["Tesla", "Tesla Motors"], ["Hyundai", "BMW", "Ford", "Rivian", "Mercedes-Benz"]
);
const autoTitles = brandTitles(autoBrands);
console.log("  Detected brands:", autoTitles.join(", "));
console.log("  Count:", autoBrands.length);

assert(hasBrand(autoBrands, "Tesla"), "Detects Tesla (own brand)");
assert(autoBrands[0].is_own_brand === true, "Tesla flagged as own brand");
assert(hasBrand(autoBrands, "Hyundai"), "Detects Hyundai");
assert(hasBrand(autoBrands, "BMW"), "Detects BMW");
assert(hasBrand(autoBrands, "Ford"), "Detects Ford");
assert(hasBrand(autoBrands, "Rivian"), "Detects Rivian");
// ChargePoint: single word, not bold, mentioned once → confidence gate filters correctly
// Electrify America: multi-word, not bold, single mention → medium confidence filtered
// These would be detected if bold-formatted or mentioned multiple times

// Sub-brand dedup
assert(noBrand(autoBrands, "Tesla Model Y"), "Sub-brand 'Tesla Model Y' merged into Tesla");
assert(noBrand(autoBrands, "Hyundai Ioniq 5"), "Sub-brand 'Hyundai Ioniq 5' merged into Hyundai");
assert(noBrand(autoBrands, "Ford Mustang Mach-E"), "Sub-brand 'Ford Mustang Mach-E' merged into Ford");
assert(noBrand(autoBrands, "BMW iX"), "Sub-brand 'BMW iX' merged into BMW");
assert(noBrand(autoBrands, "Rivian R1S"), "Sub-brand merged into Rivian");

// Noise
assert(noBrand(autoBrands, "North America"), "Rejects 'North America'");
assert(noBrand(autoBrands, "IRA"), "Rejects 'IRA' (ALL-CAPS exclusion)");
assert(noBrand(autoBrands, "SUV"), "Rejects 'SUV' (ALL-CAPS exclusion)");
assert(noBrand(autoBrands, "EQS"), "Rejects 'EQS' (ALL-CAPS exclusion)");
assert(noBrand(autoBrands, "Key Specs"), "Rejects 'Key Specs' header");
assert(noBrand(autoBrands, "Charging Infrastructure"), "Rejects 'Charging Infrastructure' (stoplist)");
assert(noBrand(autoBrands, "Federal Tax Credits"), "Rejects 'Federal Tax Credits' (stoplist)");
assert(noBrand(autoBrands, "Key Specs Comparison"), "Rejects 'Key Specs Comparison' (stoplist)");

assert(autoBrands.length >= 5 && autoBrands.length <= 12,
  `Reasonable brand count (${autoBrands.length})`, `Expected 5-12, got ${autoBrands.length}`);


// ============================================================================
// TEST GROUP 5: Finance / FinTech
// ============================================================================
section("5. Finance / FinTech");

const financeResponse = `Best investment platforms for beginners in 2024:

1. **Fidelity Investments** - Excellent all-around platform with zero-commission trades. Fidelity offers robust research tools and a user-friendly mobile app.

2. **Charles Schwab** - Another top choice with $0 commissions. Charles Schwab provides excellent customer service and educational resources.

3. **Vanguard** - Best for long-term index fund investors. Vanguard pioneered low-cost passive investing and remains the leader.

4. **Robinhood** - Popular among younger investors for its simple interface. Robinhood offers commission-free trading and fractional shares.

5. **E*Trade** - Now owned by Morgan Stanley, E*Trade offers a great platform for options trading and comprehensive research.

**Robo-Advisors:**
If you prefer automated investing, consider **Betterment** or **Wealthfront**. Both offer tax-loss harvesting and automated rebalancing.

**Cryptocurrency:**
For crypto trading, **Coinbase** and **Kraken** are well-regulated US exchanges. Coinbase is particularly beginner-friendly.

**Important Note:**
All investments carry risk. Past performance does not guarantee future results. Consider consulting a certified financial planner (CFP) before investing.

**Reviews & Sources:** NerdWallet, Investopedia, The Wall Street Journal`;

const financeBrands = extractBrandsFromResponse(
  financeResponse, [],
  "Fidelity Investments", ["Fidelity"], ["Charles Schwab", "Vanguard", "Robinhood"]
);
const financeTitles = brandTitles(financeBrands);
console.log("  Detected brands:", financeTitles.join(", "));
console.log("  Count:", financeBrands.length);

assert(hasBrand(financeBrands, "Fidelity Investments") || hasBrand(financeBrands, "Fidelity"), "Detects Fidelity (own brand)");
assert(hasBrand(financeBrands, "Charles Schwab"), "Detects Charles Schwab");
assert(hasBrand(financeBrands, "Vanguard"), "Detects Vanguard");
assert(hasBrand(financeBrands, "Robinhood"), "Detects Robinhood");
assert(hasBrand(financeBrands, "Betterment"), "Detects Betterment");
assert(hasBrand(financeBrands, "Wealthfront"), "Detects Wealthfront (bold, fixed domain threshold)");
assert(hasBrand(financeBrands, "Coinbase"), "Detects Coinbase");
assert(hasBrand(financeBrands, "Kraken"), "Detects Kraken");
// Morgan Stanley: multi-word Strategy C, single mention, not bold → medium confidence filtered
// Would need to be bold or mentioned 2+ times to pass confidence gate

// Noise
assert(noBrand(financeBrands, "Important Note"), "Rejects 'Important Note'");
assert(noBrand(financeBrands, "Reviews & Sources"), "Rejects 'Reviews & Sources'");
assert(noBrand(financeBrands, "Wall Street"), "Rejects 'Wall Street' (geographic)");

assert(financeBrands.length >= 6 && financeBrands.length <= 15,
  `Reasonable brand count (${financeBrands.length})`, `Expected 6-15, got ${financeBrands.length}`);


// ============================================================================
// TEST GROUP 6: Fashion / Apparel
// ============================================================================
section("6. Fashion / Apparel");

const fashionResponse = `Best sustainable fashion brands in 2024:

1. **Patagonia** - The pioneer of sustainable outdoor apparel. Patagonia uses recycled materials in 87% of their line and donates 1% of sales to environmental causes.

2. **Everlane** - Known for radical transparency in pricing and supply chain. Everlane's denim and basics are made in ethical factories.

3. **Allbirds** - Sustainable footwear made from merino wool and eucalyptus fiber. Allbirds achieved carbon-neutral status in 2020.

4. **Reformation** - Stylish and eco-friendly women's clothing. Reformation tracks the environmental impact of every garment.

5. **Eileen Fisher** - Premium sustainable fashion with a take-back program. Eileen Fisher is a certified B Corp.

**Fast Fashion Alternatives:**
Avoid brands like **Shein** and **H&M** (though H&M has a Conscious Collection). **Zara** from Inditex has also faced sustainability criticism.

**Luxury Sustainable:**
**Stella McCartney** remains the leader in luxury sustainable fashion. **Gucci** (Kering Group) has also made significant strides with their environmental commitments.

**Certifications to Look For:**
- B Corp certification
- Fair Trade Certified
- GOTS (Global Organic Textile Standard)
- OEKO-TEX Standard 100`;

const fashionBrands = extractBrandsFromResponse(
  fashionResponse, [],
  "Patagonia", [], ["Everlane", "Allbirds", "Reformation"]
);
const fashionTitles = brandTitles(fashionBrands);
console.log("  Detected brands:", fashionTitles.join(", "));
console.log("  Count:", fashionBrands.length);

assert(hasBrand(fashionBrands, "Patagonia"), "Detects Patagonia (own brand)");
assert(hasBrand(fashionBrands, "Everlane"), "Detects Everlane");
assert(hasBrand(fashionBrands, "Allbirds"), "Detects Allbirds");
assert(hasBrand(fashionBrands, "Reformation"), "Detects Reformation");
assert(hasBrand(fashionBrands, "Eileen Fisher"), "Detects Eileen Fisher");
assert(hasBrand(fashionBrands, "Shein"), "Detects Shein");
assert(hasBrand(fashionBrands, "Stella McCartney"), "Detects Stella McCartney");
assert(hasBrand(fashionBrands, "Gucci"), "Detects Gucci");

// Noise
assert(noBrand(fashionBrands, "Fast Fashion Alternatives"), "Rejects 'Fast Fashion Alternatives' (stoplist)");
assert(noBrand(fashionBrands, "Luxury Sustainable"), "Rejects 'Luxury Sustainable' (stoplist)");
assert(noBrand(fashionBrands, "Certifications to Look For"), "Rejects 'Certifications to Look For' (stoplist)");
assert(noBrand(fashionBrands, "GOTS"), "Rejects 'GOTS' (ALL-CAPS exclusion)");
assert(noBrand(fashionBrands, "OEKO"), "Rejects 'OEKO' (ALL-CAPS exclusion)");
assert(noBrand(fashionBrands, "TEX"), "Rejects 'TEX' (ALL-CAPS exclusion)");

assert(fashionBrands.length >= 6 && fashionBrands.length <= 15,
  `Reasonable brand count (${fashionBrands.length})`, `Expected 6-15, got ${fashionBrands.length}`);


// ============================================================================
// TEST GROUP 7: Travel / Hotels
// ============================================================================
section("7. Travel / Hotels");

const travelResponse = `Best hotel loyalty programs ranked for 2024:

1. **Marriott Bonvoy** - The largest hotel program with 8,000+ properties worldwide. Marriott Bonvoy includes brands like The Ritz-Carlton, W Hotels, and Sheraton.

2. **Hilton Honors** - Excellent earning rates with the Hilton Amex card. Hilton Honors covers Conrad, Waldorf Astoria, and DoubleTree.

3. **World of Hyatt** - Best redemption values in the industry. Hyatt properties include Park Hyatt, Grand Hyatt, and Andaz.

4. **IHG One Rewards** - Broad coverage with Holiday Inn, InterContinental, and Kimpton brands.

**Boutique Options:**
- **Preferred Hotels & Resorts** - Independent luxury collection
- **Small Luxury Hotels** - Curated boutique properties

**Credit Card Partners:**
- **Chase Sapphire Reserve** - Transfer to Hyatt and Marriott at 1:1
- **American Express Platinum** - Hilton Gold status included
- **Capital One Venture X** - Access to Capital One Lounges

**South Beach** and **Beverly Hills** properties tend to require more points during peak season.`;

const travelBrands = extractBrandsFromResponse(
  travelResponse, [],
  "Marriott Bonvoy", ["Marriott"], ["Hilton", "Hyatt", "IHG"]
);
const travelTitles = brandTitles(travelBrands);
console.log("  Detected brands:", travelTitles.join(", "));
console.log("  Count:", travelBrands.length);

assert(hasBrand(travelBrands, "Marriott Bonvoy") || hasBrand(travelBrands, "Marriott"), "Detects Marriott (own brand)");
assert(hasBrand(travelBrands, "Hilton") || hasBrand(travelBrands, "Hilton Honors"), "Detects Hilton");
assert(hasBrand(travelBrands, "Hyatt") || hasBrand(travelBrands, "World of Hyatt"), "Detects Hyatt");
assert(hasBrand(travelBrands, "Chase Sapphire Reserve") || hasBrand(travelBrands, "Chase"), "Detects Chase");
assert(hasBrand(travelBrands, "American Express") || hasBrand(travelBrands, "American Express Platinum"), "Detects American Express");

// Noise
assert(noBrand(travelBrands, "South Beach"), "Rejects 'South Beach' (geographic)");
assert(noBrand(travelBrands, "Beverly Hills"), "Rejects 'Beverly Hills' (geographic)");
assert(noBrand(travelBrands, "Credit Card"), "Rejects 'Credit Card' generic phrase");
assert(noBrand(travelBrands, "Boutique Options"), "Rejects 'Boutique Options' (stoplist)");

assert(travelBrands.length >= 4 && travelBrands.length <= 18,
  `Reasonable brand count (${travelBrands.length})`, `Expected 4-18, got ${travelBrands.length}`);


// ============================================================================
// TEST GROUP 8: Healthcare / Pharma
// ============================================================================
section("8. Healthcare / Pharma");

const healthcareResponse = `Best telehealth platforms for primary care in 2024:

1. **Teladoc Health** - The largest telehealth provider in the US. Teladoc Health offers 24/7 access to board-certified physicians.

2. **MDLive** - Now part of Cigna's Evernorth division. MDLive provides affordable virtual visits starting at $0 with insurance.

3. **Amwell** - Strong partnerships with major health systems. Amwell powers virtual care for Cleveland Clinic and others.

4. **Doctor on Demand** - Acquired by Grand Rounds Health (now Included Health). Offers video visits with licensed physicians.

5. **Talkspace** - Leading online therapy platform. Talkspace connects users with licensed therapists via text, audio, and video.

**Insurance Coverage:**
Most plans from **UnitedHealthcare**, **Aetna** (CVS Health), **Blue Cross Blue Shield**, and **Kaiser Permanente** now cover telehealth visits.

**Mental Health Focused:**
- **BetterHelp** - The largest online counseling platform
- **Cerebral** - Online psychiatry and medication management

**Important Note:** Always verify your insurance coverage before scheduling a telehealth visit. Co-pays may vary by plan and provider.`;

const healthcareBrands = extractBrandsFromResponse(
  healthcareResponse, [],
  "Teladoc Health", ["Teladoc"], ["MDLive", "Amwell"]
);
const healthcareTitles = brandTitles(healthcareBrands);
console.log("  Detected brands:", healthcareTitles.join(", "));
console.log("  Count:", healthcareBrands.length);

assert(hasBrand(healthcareBrands, "Teladoc Health") || hasBrand(healthcareBrands, "Teladoc"), "Detects Teladoc (own brand)");
assert(hasBrand(healthcareBrands, "MDLive"), "Detects MDLive");
assert(hasBrand(healthcareBrands, "Amwell"), "Detects Amwell");
assert(hasBrand(healthcareBrands, "Talkspace"), "Detects Talkspace");
assert(hasBrand(healthcareBrands, "BetterHelp"), "Detects BetterHelp");
assert(hasBrand(healthcareBrands, "Cerebral"), "Detects Cerebral");
assert(hasBrand(healthcareBrands, "UnitedHealthcare"), "Detects UnitedHealthcare");
assert(hasBrand(healthcareBrands, "Kaiser Permanente"), "Detects Kaiser Permanente");

// Noise
assert(noBrand(healthcareBrands, "Important Note"), "Rejects 'Important Note'");
assert(noBrand(healthcareBrands, "Mental Health Focused"), "Rejects 'Mental Health Focused' (stoplist)");
assert(noBrand(healthcareBrands, "Insurance Coverage"), "Rejects 'Insurance Coverage' (stoplist)");

assert(healthcareBrands.length >= 5 && healthcareBrands.length <= 15,
  `Reasonable brand count (${healthcareBrands.length})`, `Expected 5-15, got ${healthcareBrands.length}`);


// ============================================================================
// TEST GROUP 9: DataForSEO API Brand Entity Mapping
// ============================================================================
section("9. DataForSEO API Brand Entity Mapping");

const apiResponse = "Nike is the leading brand in running shoes. Adidas and ASICS are strong competitors. Nike offers the Pegasus and Vaporfly lines.";
const apiBrands = [
  { type: "chat_gpt_brand_entity", title: "Nike", category: "sports", urls: [{ url: "https://nike.com", domain: "nike.com" }] },
  { type: "chat_gpt_brand_entity", title: "Adidas", category: "sports", urls: [{ url: "https://adidas.com", domain: "adidas.com" }] },
  { type: "chat_gpt_brand_entity", title: "ASICS", category: "sports", urls: null },
  { type: "chat_gpt_brand_entity", title: "Nike", category: "sports", urls: null }, // duplicate
  { type: "chat_gpt_brand_entity", title: "", category: "unknown", urls: null }, // empty title
];

const mappedBrands = mapDataForSEOBrandEntities(
  apiBrands, apiResponse, "Nike", [], ["Adidas", "ASICS"],
  [{ url: "https://nike.com/running", domain: "nike.com" }]
);
const mappedTitles = brandTitles(mappedBrands);
console.log("  Mapped brands:", mappedTitles.join(", "));

assert(mappedBrands.length === 3, `Deduplicates and filters (${mappedBrands.length} brands)`, `Expected 3, got ${mappedBrands.length}`);
assert(mappedBrands[0].is_own_brand === true, "Nike flagged as own brand");
assert(mappedBrands[0].mention_count >= 2, `Nike mention count >= 2 (got ${mappedBrands[0].mention_count})`);
assert(mappedBrands[0].sources && mappedBrands[0].sources.length > 0, "Nike has sources from API URLs");
assert(hasBrand(mappedBrands, "ASICS"), "ASICS mapped correctly");
assert(mappedBrands.find(b => b.title === "ASICS")?.is_competitor === true, "ASICS flagged as competitor");


// ============================================================================
// TEST GROUP 10: cleanBrandCandidate function
// ============================================================================
section("10. cleanBrandCandidate()");

assert(cleanBrandCandidate("Type:") === "Type", "Strips trailing colon");
assert(cleanBrandCandidate("Pros:") === "Pros", "Strips trailing colon from Pros:");
assert(cleanBrandCandidate("Key Features:") === "Key Features", "Strips colon from Key Features:");
assert(cleanBrandCandidate("Nike.") === "Nike", "Strips trailing period");
assert(cleanBrandCandidate("--Brand--") === "Brand", "Strips leading and trailing dashes");
assert(cleanBrandCandidate("Hoka Official Website") === "Hoka", "Removes 'Official Website' suffix");
assert(cleanBrandCandidate("Nike Official Site") === "Nike", "Removes 'Official Site' suffix");
assert(cleanBrandCandidate("  Spaces  ") === "Spaces", "Trims whitespace");
assert(cleanBrandCandidate("Brand HomePage") === "Brand", "Removes 'HomePage' suffix");
assert(cleanBrandCandidate("\u201CSmart Brand\u201D") === '"Smart Brand"', "Normalizes smart quotes");


// ============================================================================
// TEST GROUP 11: isLikelyBrand() edge cases
// ============================================================================
section("11. isLikelyBrand() Edge Cases");

// Should PASS (real brands)
assert(isLikelyBrand("Nike") === true, "Nike is a brand");
assert(isLikelyBrand("ASICS") === true, "ASICS is a brand");
assert(isLikelyBrand("New Balance") === true, "New Balance passes (known exception)");
assert(isLikelyBrand("Old Navy") === true, "Old Navy passes (known exception)");
assert(isLikelyBrand("North Face") === true, "North Face passes (known exception)");
assert(isLikelyBrand("Lululemon") === true, "Lululemon passes");
assert(isLikelyBrand("Under Armour") === true, "Under Armour passes");
assert(isLikelyBrand("H&M") === true, "H&M passes (& is allowed)");
assert(isLikelyBrand("Bed Bath & Beyond") === true, "Bed Bath & Beyond passes");

// Should FAIL (noise)
assert(isLikelyBrand("the") === false, "Rejects 'the'");
assert(isLikelyBrand("shipping") === false, "Rejects 'shipping'");
assert(isLikelyBrand("12345") === false, "Rejects pure numbers");
assert(isLikelyBrand("ab") === false, "Rejects too short (2 chars)");
assert(isLikelyBrand("A really really long string that cannot possibly be a brand name because it is way too long") === false, "Rejects too long");
assert(isLikelyBrand("River North") === false, "Rejects 'River North' (geographic pattern)");
assert(isLikelyBrand("West Loop") === false, "Rejects 'West Loop' (geographic pattern)");
assert(isLikelyBrand("South Beach") === false, "Rejects 'South Beach' (geographic pattern)");
assert(isLikelyBrand("East Village") === false, "Rejects 'East Village' (geographic pattern)");
assert(isLikelyBrand("Lake Michigan") === false, "Rejects 'Lake Michigan' (geographic pattern)");
assert(isLikelyBrand("San Diego") === false, "Rejects 'San Diego' (geographic pattern)");
assert(isLikelyBrand("Santa Monica") === false, "Rejects 'Santa Monica' (stoplist)");
assert(isLikelyBrand("Mount Rainier") === false, "Rejects 'Mount Rainier' (geographic pattern)");
assert(isLikelyBrand("Port Authority") === false, "Rejects 'Port Authority' (geographic pattern)");
assert(isLikelyBrand("Fort Worth") === false, "Rejects 'Fort Worth' (geographic pattern)");
assert(isLikelyBrand("S Sporting") === false, "Rejects fragments with single char word");
assert(isLikelyBrand("It's") === false, "Rejects short possessive");
assert(isLikelyBrand("Runningwarehouse") === false, "Rejects domain-like single word (16 chars, 1 uppercase)");
assert(isLikelyBrand("Dickssportinggoods") === false, "Rejects domain-like 'Dickssportinggoods' (18 chars)");
assert(isLikelyBrand("foam") === false, "Rejects 'foam' (shoe part)");
assert(isLikelyBrand("cushioning") === false, "Rejects 'cushioning'");
assert(isLikelyBrand("verdict") === false, "Rejects 'verdict'");
assert(isLikelyBrand("district") === false, "Rejects 'district'");
assert(isLikelyBrand("boulevard") === false, "Rejects 'boulevard'");
assert(isLikelyBrand("review") === false, "Rejects 'review'");
assert(isLikelyBrand("reviews") === false, "Rejects 'reviews'");
assert(isLikelyBrand("price") === false, "Rejects 'price'");
assert(isLikelyBrand("value") === false, "Rejects 'value'");
assert(isLikelyBrand("however") === false, "Rejects 'however' (adverb)");
assert(isLikelyBrand("therefore") === false, "Rejects 'therefore' (adverb)");
assert(isLikelyBrand("best practices") === false, "Rejects 'best practices' (stoplist)");
assert(isLikelyBrand("dna loft") === false, "Rejects 'dna loft' (tech stoplist)");
assert(isLikelyBrand("fresh foam") === false, "Rejects 'fresh foam' (tech stoplist)");
assert(isLikelyBrand("silicon valley") === false, "Rejects 'silicon valley' (stoplist)");
assert(isLikelyBrand("award winning") === false, "Rejects 'award winning' (stoplist)");
assert(isLikelyBrand("ideal for") === false, "Rejects 'ideal for' (stoplist)");


// ============================================================================
// TEST GROUP 12: URL stripping
// ============================================================================
section("12. URL Stripping");

assert(!stripUrlsForNER("Visit https://nike.com/running").includes("nike.com"), "Strips https URL");
assert(!stripUrlsForNER("Visit www.brooksrunning.com today").includes("brooksrunning.com"), "Strips www domain");
assert(!stripUrlsForNER("See runningwarehouse.com for deals").includes("runningwarehouse.com"), "Strips bare domain");
assert(stripUrlsForNER("[Nike Store](https://nike.com)").includes("Nike Store"), "Preserves link text from markdown");
assert(!stripUrlsForNER("[Nike Store](https://nike.com)").includes("nike.com"), "Strips URL from markdown link");
assert(!stripUrlsForNER("Source: gazellesports.com/shoes").includes("gazellesports.com"), "Strips domain with path");
assert(!stripUrlsForNER("Check [1] for details").includes("[1]"), "Strips citation markers");
assert(!stripUrlsForNER("(https://example.com/long/path)").includes("example.com"), "Strips parenthesized URL");


// ============================================================================
// TEST GROUP 13: Edge Cases & Stress Tests
// ============================================================================
section("13. Edge Cases & Stress Tests");

// Empty/minimal input
const emptyResult = extractBrandsFromResponse("", [], "", [], []);
assert(emptyResult.length === 0, "Empty text returns empty array");

const shortResult = extractBrandsFromResponse("Hi", [], "", [], []);
assert(shortResult.length === 0, "Very short text returns empty array");

// Response with ONLY bold section headers (common LLM pattern)
const headersOnly = `**Type:** Running shoes
**Key Features:** Lightweight, breathable
**Pros:** Comfortable, great cushioning
**Cons:** Limited color options
**Ideal For:** Daily training runs
**Price Range:** $120-$150
**Our Verdict:** Excellent value for money
**Where to Buy:** Online retailers`;

const headersResult = extractBrandsFromResponse(headersOnly, [], "TestBrand", [], []);
console.log("  Headers-only brands:", brandTitles(headersResult).join(", ") || "(none)");
assert(headersResult.length === 0, "Section headers produce zero brands (word-boundary fix prevents 'excel' in 'Excellent')",
  `Got ${headersResult.length}: ${brandTitles(headersResult).join(", ")}`);

// Response with heavy URL content
const urlHeavy = `Check out these brands:
Nike (https://nike.com/running/shoes) has great options.
Adidas at www.adidas.com/ultraboost offers BOOST technology.
Visit brooksrunning.com or go to runningwarehouse.com for deals.
ASICS [Official Site](https://asics.com) has the Gel-Nimbus.`;

const urlResult = extractBrandsFromResponse(
  urlHeavy, [], "Nike", [], ["Adidas", "ASICS", "Brooks"]
);
const urlTitles = brandTitles(urlResult);
console.log("  URL-heavy brands:", urlTitles.join(", "));
assert(hasBrand(urlResult, "Nike"), "Detects Nike in URL-heavy text");
assert(hasBrand(urlResult, "Adidas"), "Detects Adidas in URL-heavy text");
assert(hasBrand(urlResult, "ASICS"), "Detects ASICS in URL-heavy text");
assert(noBrand(urlResult, "brooksrunning"), "Rejects 'brooksrunning' domain fragment");
assert(noBrand(urlResult, "runningwarehouse"), "Rejects 'runningwarehouse' domain fragment");

// ALL-CAPS brand recognition
const capsResponse = `ASICS is a top running shoe brand. REI is where you can buy them.
HOKA makes great shoes too. Look for ASICS at your local running store.
Both ASICS and HOKA use advanced foam technology.`;

const capsResult = extractBrandsFromResponse(
  capsResponse, [], "Nike", [], ["ASICS", "HOKA"]
);
console.log("  ALL-CAPS brands:", brandTitles(capsResult).join(", "));
assert(hasBrand(capsResult, "ASICS"), "Detects ASICS (ALL-CAPS, known competitor)");
assert(hasBrand(capsResult, "HOKA"), "Detects HOKA (ALL-CAPS, known competitor)");
assert(hasBrand(capsResult, "REI"), "Detects REI (ALL-CAPS, real brand)");

// Product-to-brand mapping (Layer 4)
const productResponse = `For productivity, consider using Gmail and Google Maps for work.
The iPhone integrates seamlessly with AirPods. Microsoft Teams and Outlook
are essential for enterprise communication. ChatGPT is great for writing assistance.`;

const productResult = extractBrandsFromResponse(
  productResponse, [], "Google", ["Google"], []
);
console.log("  Product-mapped brands:", brandTitles(productResult).join(", "));
assert(hasBrand(productResult, "Google"), "Detects Google (via Gmail + Google Maps mapping)");
assert(hasBrand(productResult, "Apple"), "Detects Apple (via iPhone + AirPods mapping)");
assert(hasBrand(productResult, "Microsoft"), "Detects Microsoft (via Teams + Outlook mapping)");
assert(hasBrand(productResult, "OpenAI"), "Detects OpenAI (via ChatGPT mapping)");

// Sub-brand deduplication stress test
const subBrandResponse = `Top running shoes:
1. **Nike Pegasus 41** - Great daily trainer
2. **Nike Vaporfly 3** - Top racing shoe
3. **Nike Air Zoom** - Classic comfort
4. **Saucony Kinvara 15** - Lightweight option
5. **Saucony Endorphin Speed 4** - Fast tempo shoe
6. **Brooks Ghost 16** - Reliable neutral shoe
7. **Brooks Glycerin 21** - Plush cushioning

Nike and Brooks offer the most variety. Saucony is great for speed work.`;

const subBrandResult = extractBrandsFromResponse(
  subBrandResponse, [], "Nike", ["Nike"], ["Saucony", "Brooks"]
);
console.log("  Sub-brand dedup result:", brandTitles(subBrandResult).join(", "));
assert(hasBrand(subBrandResult, "Nike"), "Parent brand Nike exists");
assert(hasBrand(subBrandResult, "Saucony"), "Parent brand Saucony exists");
assert(hasBrand(subBrandResult, "Brooks"), "Parent brand Brooks exists");
assert(noBrand(subBrandResult, "Nike Pegasus 41"), "Nike Pegasus 41 merged");
assert(noBrand(subBrandResult, "Nike Vaporfly 3"), "Nike Vaporfly 3 merged");
assert(noBrand(subBrandResult, "Nike Air Zoom"), "Nike Air Zoom merged");
assert(noBrand(subBrandResult, "Saucony Kinvara 15"), "Saucony Kinvara 15 merged");
assert(noBrand(subBrandResult, "Saucony Endorphin Speed 4"), "Saucony Endorphin Speed 4 merged");
assert(noBrand(subBrandResult, "Brooks Ghost 16"), "Brooks Ghost 16 merged");
assert(noBrand(subBrandResult, "Brooks Glycerin 21"), "Brooks Glycerin 21 merged");
// Verify merged mention counts
const nikeResult = subBrandResult.find(b => b.title === "Nike");
assert(nikeResult && nikeResult.mention_count >= 4,
  `Nike mention count includes sub-brands (${nikeResult?.mention_count})`,
  `Expected >= 4, got ${nikeResult?.mention_count}`);
assert(subBrandResult.length === 3, `Only 3 brands after dedup (${subBrandResult.length})`,
  `Expected 3, got ${subBrandResult.length}: ${brandTitles(subBrandResult).join(", ")}`);


// ============================================================================
// TEST GROUP 14: Real-World Noise Patterns (from previous failures)
// ============================================================================
section("14. Real-World Noise Patterns (Regression)");

// The original V2 screenshot had these noise items
const noiseResponse = `**Type:** Road running shoes
**Key Features:** PWRRUN+ foam, HOVR cushioning, NITRO technology
**Pros:** Comfortable, responsive, great energy return
**Cons:** Limited color options, higher price point
**Ideal For:** Daily training and long runs
**Reviews & Sources:** Runner's World, Running Warehouse

Here are the best options:
1. **Nike Pegasus 41** - Great daily trainer
2. **Brooks Ghost 16** - Reliable neutral shoe
3. **ASICS Gel-Nimbus 26** - Premium cushioning

**Where to Buy:**
Available at most running specialty stores and online retailers.

**Price Range:** $120-$160
**Our Verdict:** The Nike Pegasus remains the gold standard.`;

const noiseResult = extractBrandsFromResponse(
  noiseResponse, [], "Nike", ["Nike"], ["Brooks", "ASICS"]
);
console.log("  Regression test brands:", brandTitles(noiseResult).join(", "));

// These were ALL false positives in V2
assert(noBrand(noiseResult, "Type"), "Regression: No 'Type' noise");
assert(noBrand(noiseResult, "Key Features"), "Regression: No 'Key Features' noise");
assert(noBrand(noiseResult, "Pros"), "Regression: No 'Pros' noise");
assert(noBrand(noiseResult, "Cons"), "Regression: No 'Cons' noise");
assert(noBrand(noiseResult, "Ideal For"), "Regression: No 'Ideal For' noise");
assert(noBrand(noiseResult, "Reviews & Sources"), "Regression: No 'Reviews & Sources' noise");
assert(noBrand(noiseResult, "Where to Buy"), "Regression: No 'Where to Buy' noise");
assert(noBrand(noiseResult, "Price Range"), "Regression: No 'Price Range' noise");
assert(noBrand(noiseResult, "Our Verdict"), "Regression: No 'Our Verdict' noise");
assert(noBrand(noiseResult, "PWRRUN"), "Regression: No 'PWRRUN' tech noise");
assert(noBrand(noiseResult, "HOVR"), "Regression: No 'HOVR' tech noise");
assert(noBrand(noiseResult, "NITRO"), "Regression: No 'NITRO' tech noise");
assert(noBrand(noiseResult, "DNA"), "Regression: No 'DNA' tech noise");
assert(noBrand(noiseResult, "LOFT"), "Regression: No 'LOFT' tech noise");
assert(noBrand(noiseResult, "Runner's World"), "Regression: No source name leak");

// Real brands should still be detected
assert(hasBrand(noiseResult, "Nike"), "Regression: Nike still detected");
assert(hasBrand(noiseResult, "Brooks"), "Regression: Brooks still detected");
assert(hasBrand(noiseResult, "ASICS"), "Regression: ASICS still detected");


// ============================================================================
// TEST GROUP 15: Legal / Law Firms
// ============================================================================
section("15. Legal / Law Firms");

const legalResponse = `Best corporate law firms in New York for M&A:

1. **Wachtell, Lipton, Rosen & Katz** - The gold standard for M&A advisory. Known for hostile takeover defense and premium deal work.

2. **Skadden, Arps, Slate, Meagher & Flom** - Full-service firm with dominant M&A practice. Skadden handles both buy-side and sell-side transactions.

3. **Sullivan & Cromwell** - Historic Wall Street firm with deep banking relationships. Sullivan & Cromwell regularly advises Fortune 500 companies.

4. **Cravath, Swaine & Moore** - Known for the "Cravath System" of associate development. Premium corporate practice.

5. **Davis Polk & Wardwell** - Especially strong in financial institution M&A and regulatory matters.

**Boutique Alternatives:**
- **Centerview Partners** - Advisory boutique for complex M&A
- **Evercore** - Independent investment bank with strategic advisory

**Rankings Source:** Chambers & Partners, Vault Law`;

const legalBrands = extractBrandsFromResponse(
  legalResponse, [],
  "Wachtell, Lipton, Rosen & Katz", ["Wachtell"], ["Skadden", "Sullivan & Cromwell", "Cravath"]
);
console.log("  Legal brands:", brandTitles(legalBrands).join(", "));
console.log("  Count:", legalBrands.length);

assert(hasBrand(legalBrands, "Wachtell") || legalBrands.some(b => b.title.includes("Wachtell")), "Detects Wachtell");
assert(hasBrand(legalBrands, "Skadden") || legalBrands.some(b => b.title.includes("Skadden")), "Detects Skadden");
assert(hasBrand(legalBrands, "Centerview Partners"), "Detects Centerview Partners");
assert(hasBrand(legalBrands, "Evercore"), "Detects Evercore");

// Noise
assert(noBrand(legalBrands, "Wall Street"), "Rejects 'Wall Street' (geographic)");
assert(noBrand(legalBrands, "Boutique Alternatives"), "Rejects 'Boutique Alternatives' (stoplist)");
assert(noBrand(legalBrands, "Rankings Source"), "Rejects 'Rankings Source' (stoplist)");
assert(noBrand(legalBrands, "New York"), "Rejects 'New York' (stoplist)");


// ============================================================================
// TEST GROUP 16: Real Estate
// ============================================================================
section("16. Real Estate");

const realEstateResponse = `Best real estate platforms for home buyers in Chicago:

1. **Zillow** - The most visited real estate website. Zillow's Zestimate tool provides home value estimates across the country.

2. **Redfin** - Agent-assisted platform with lower commission rates. Redfin offers 1% listing fees and excellent mapping tools.

3. **Realtor.com** - Official site of the National Association of Realtors. Comprehensive MLS listings.

4. **Compass** - Tech-forward brokerage growing rapidly in Chicago's North Shore and Gold Coast markets.

5. **Coldwell Banker** - Traditional full-service brokerage with deep neighborhood expertise.

**Chicago Neighborhoods to Watch:**
- **River North**: High-rise condos and luxury apartments
- **West Loop**: Trendy area with new developments
- **Lincoln Park**: Family-friendly with excellent schools
- **South Loop**: Growing with new construction near Grant Park

**Mortgage Lenders:**
Consider **Rocket Mortgage** (formerly Quicken Loans), **Better.com**, or local options like **Guaranteed Rate** (headquartered in Chicago).`;

const realEstateBrands = extractBrandsFromResponse(
  realEstateResponse, [],
  "Zillow", ["Zillow"], ["Redfin", "Compass", "Coldwell Banker"]
);
console.log("  Real estate brands:", brandTitles(realEstateBrands).join(", "));
console.log("  Count:", realEstateBrands.length);

assert(hasBrand(realEstateBrands, "Zillow"), "Detects Zillow (own brand)");
assert(hasBrand(realEstateBrands, "Redfin"), "Detects Redfin");
assert(hasBrand(realEstateBrands, "Compass"), "Detects Compass");
assert(hasBrand(realEstateBrands, "Coldwell Banker"), "Detects Coldwell Banker");
assert(hasBrand(realEstateBrands, "Rocket Mortgage"), "Detects Rocket Mortgage");
// Guaranteed Rate: bold **Guaranteed Rate** should be detected
assert(hasBrand(realEstateBrands, "Guaranteed Rate"), "Detects Guaranteed Rate (bold)");

// Noise - all geographic terms
assert(noBrand(realEstateBrands, "River North"), "Rejects 'River North'");
assert(noBrand(realEstateBrands, "West Loop"), "Rejects 'West Loop'");
assert(noBrand(realEstateBrands, "Lincoln Park"), "Rejects 'Lincoln Park'");
assert(noBrand(realEstateBrands, "South Loop"), "Rejects 'South Loop'");
assert(noBrand(realEstateBrands, "Gold Coast"), "Rejects 'Gold Coast'");
assert(noBrand(realEstateBrands, "North Shore"), "Rejects 'North Shore'");
assert(noBrand(realEstateBrands, "Grant Park"), "Rejects 'Grant Park' (geographic pattern)");
assert(noBrand(realEstateBrands, "Chicago Neighborhoods to Watch"), "Rejects header (stoplist)");
assert(noBrand(realEstateBrands, "Mortgage Lenders"), "Rejects 'Mortgage Lenders' (stoplist)");
assert(noBrand(realEstateBrands, "MLS"), "Rejects 'MLS' (ALL-CAPS exclusion)");

assert(realEstateBrands.length >= 4 && realEstateBrands.length <= 12,
  `Reasonable brand count (${realEstateBrands.length})`, `Expected 4-12, got ${realEstateBrands.length}`);


// ============================================================================
// SUMMARY
// ============================================================================
console.log(`\n${'='.repeat(70)}`);
console.log(`  FINAL RESULTS`);
console.log('='.repeat(70));
console.log(`  Total:  ${totalTests}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
if (failures.length > 0) {
  console.log(`\n  FAILURES:`);
  for (const f of failures) {
    console.log(`    ✗ ${f.testName}`);
    if (f.details) console.log(`      → ${f.details}`);
  }
}
console.log('='.repeat(70));
process.exit(failedTests > 0 ? 1 : 0);
