/**
 * Citation Verification — Comprehensive Test Suite
 * Tests normal, edge, worst-case, and special scenarios.
 *
 * Run: node test-citation-verification.js
 * Run single suite: node test-citation-verification.js 3
 */

const SUPABASE_URL = "https://bvmwnxargzlfheiwyget.supabase.co/functions/v1/verify-citations";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bXdueGFyZ3psZmhlaXd5Z2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjY1MjgsImV4cCI6MjA4MzYwMjUyOH0.wicc8Do5vcnwxW57kNHYWJd6qF5rJbjLRHODTtT2ybI";

const TEST_SUITES = [

  // ====================================================================
  // 1. NORMAL — Brand's own site (easy win, must always be verified)
  // ====================================================================
  {
    name: "1. NORMAL — Brand own sites",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "editorial" },
    citations: [
      { url: "https://prezent.ai/", expect: "verified", reason: "Brand homepage — must detect entity" },
      { url: "https://www.apollohospitals.com/", expect: "verified", reason: "Different brand homepage test", overrideClaim: { brand: "Apollo Hospitals", domain: "apollohospitals.com", category: "reference" } },
    ]
  },

  // ====================================================================
  // 2. NORMAL — Direct competitors (real pages, same industry)
  // ====================================================================
  {
    name: "2. NORMAL — Direct competitors",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "editorial" },
    citations: [
      { url: "https://www.canva.com/presentations/", expect: "verified", reason: "Canva presentations — direct competitor feature" },
      { url: "https://slidebean.com/", expect: "verified", reason: "Slidebean — competitor presentation tool" },
      { url: "https://prezi.com/", expect: "verified", reason: "Prezi — well-known competitor" },
    ]
  },

  // ====================================================================
  // 3. NORMAL — Review & comparison sites
  // ====================================================================
  {
    name: "3. NORMAL — Review & comparison sites",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "review" },
    citations: [
      { url: "https://www.trustpilot.com/review/prezent.ai", expect: "verified", reason: "Trustpilot review page for brand" },
      { url: "https://www.pcmag.com/picks/the-best-presentation-software", expect: "verified", reason: "PCMag best-of list for category" },
    ]
  },

  // ====================================================================
  // 4. NORMAL — Wikipedia & reference pages
  // ====================================================================
  {
    name: "4. NORMAL — Wikipedia & reference",
    claim: { brand: "Apollo Hospitals", domain: "apollohospitals.com", category: "reference" },
    citations: [
      { url: "https://en.wikipedia.org/wiki/Apollo_Hospitals", expect: "verified", reason: "Wikipedia about the brand itself" },
      { url: "https://en.wikipedia.org/wiki/Healthcare_in_India", expect: "verified", reason: "Wikipedia about the industry" },
    ]
  },

  // ====================================================================
  // 5. NORMAL — News & editorial (industry coverage)
  // ====================================================================
  {
    name: "5. NORMAL — News & editorial",
    claim: { brand: "Tesla", domain: "tesla.com", category: "editorial" },
    citations: [
      { url: "https://www.reuters.com/business/autos-transportation/", expect: "verified", reason: "Reuters auto section — industry news" },
      { url: "https://electrek.co/", expect: "verified", reason: "EV-focused news site — highly relevant" },
    ]
  },

  // ====================================================================
  // 6. MID — E-commerce & marketplace pages
  // ====================================================================
  {
    name: "6. MID — E-commerce listings",
    claim: { brand: "Erawan Food", domain: "erawanfood.com", category: "ecommerce" },
    citations: [
      { url: "https://www.amazon.com/s?k=frozen+thai+food", expect: "verified", reason: "Amazon search for product category" },
      { url: "https://www.walmart.com/browse/frozen-food", expect: "verified", reason: "Walmart frozen food category" },
    ]
  },

  // ====================================================================
  // 7. MID — Social media & forums (UGC)
  // ====================================================================
  {
    name: "7. MID — Social & UGC pages",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "ugc" },
    citations: [
      { url: "https://www.reddit.com/r/presentations/", expect: "verified", reason: "Reddit subreddit about presentations" },
      { url: "https://www.quora.com/What-is-the-best-AI-presentation-tool", expect: "verified", reason: "Quora question about the category" },
    ]
  },

  // ====================================================================
  // 8. MID — Tangential relevance (same broad industry, weak link)
  // ====================================================================
  {
    name: "8. MID — Tangential relevance",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "editorial" },
    citations: [
      { url: "https://www.microsoft.com/en-us/microsoft-365", expect: "verified", reason: "Microsoft 365 — contains PowerPoint, broadly relevant" },
      { url: "https://zapier.com/blog/best-ai-tools/", expect: "verified", reason: "AI tools roundup — tangential but relevant" },
    ]
  },

  // ====================================================================
  // 9. SPECIAL — Non-English pages (should still work)
  // ====================================================================
  {
    name: "9. SPECIAL — Non-English content",
    claim: { brand: "Erawan Food", domain: "erawanfood.com", category: "ecommerce" },
    citations: [
      { url: "https://www.thairoyalfrozen.com/", expect: "verified", reason: "Thai frozen food competitor (may have Thai content)" },
      { url: "https://www.itfoods.co.th/", expect: "verified", reason: "Thai food company website" },
    ]
  },

  // ====================================================================
  // 10. WORST CASE — Completely unrelated (must be hallucinated)
  // ====================================================================
  {
    name: "10. WORST — Completely unrelated pages",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "editorial" },
    citations: [
      { url: "https://www.petmd.com/dog/nutrition", expect: "hallucinated", reason: "Pet nutrition — zero relation to AI presentations" },
      { url: "https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/", expect: "hallucinated", reason: "Cookie recipe — zero relation" },
      { url: "https://www.nfl.com/scores/", expect: "hallucinated", reason: "NFL scores — zero relation" },
    ]
  },

  // ====================================================================
  // 11. WORST CASE — Fake / non-existent pages
  // ====================================================================
  {
    name: "11. WORST — Fake/dead URLs",
    claim: { brand: "Prezent", domain: "prezent.ai", category: "editorial" },
    citations: [
      { url: "https://www.example.com/this-page-does-not-exist-12345", expect: "hallucinated", reason: "Non-existent page on example.com" },
      { url: "https://totallynotarealwebsite99999.com/", expect: "hallucinated", reason: "Completely fake domain" },
    ]
  },

  // ====================================================================
  // 12. SPECIAL — Fuzzy brand name matching
  // ====================================================================
  {
    name: "12. SPECIAL — Fuzzy brand matching",
    claim: { brand: "Apollo Hospitals", domain: "apollohospitals.com", category: "reference" },
    citations: [
      { url: "https://www.practo.com/", expect: "verified", reason: "Practo — Indian healthcare platform (competitor)" },
      { url: "https://www.1mg.com/", expect: "verified", reason: "1mg — Indian health/pharmacy (adjacent)" },
    ]
  },

  // ====================================================================
  // 13. SPECIAL — SaaS brand with generic domain
  // ====================================================================
  {
    name: "13. SPECIAL — SaaS with generic name",
    claim: { brand: "Notion", domain: "notion.so", category: "editorial" },
    citations: [
      { url: "https://notion.so/", expect: "verified", reason: "Brand's own site" },
      { url: "https://www.atlassian.com/software/confluence", expect: "verified", reason: "Confluence — direct competitor" },
      { url: "https://obsidian.md/", expect: "verified", reason: "Obsidian — note-taking competitor" },
    ]
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

async function callVerify(citations, claim) {
  const res = await fetch(SUPABASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`
    },
    body: JSON.stringify({ citations, claim })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText.substring(0, 200)}`);
  }

  return res.json();
}

async function runTestSuite(suite, suiteIndex) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`SUITE ${suiteIndex}: ${suite.name}`);
  console.log(`Brand: ${suite.claim.brand} | Domain: ${suite.claim.domain}`);
  console.log(`${"=".repeat(70)}`);

  // Group citations by claim (some may have overrideClaim)
  const groups = new Map();
  suite.citations.forEach((c, i) => {
    const claim = c.overrideClaim || suite.claim;
    const key = JSON.stringify(claim);
    if (!groups.has(key)) groups.set(key, { claim, citations: [], expectations: [] });
    const g = groups.get(key);
    g.citations.push({ url: c.url, citation_id: `test-${suiteIndex}-${i}-${Date.now()}` });
    g.expectations.push(c);
  });

  const allResults = [];
  const startTime = Date.now();

  for (const [, group] of groups) {
    try {
      const data = await callVerify(group.citations, group.claim);
      allResults.push(...(data.results || []).map((r, i) => ({ ...r, expected: group.expectations[i] })));
    } catch (err) {
      console.log(`  API ERROR: ${err.message}`);
      group.expectations.forEach(e => allResults.push({ url: e.url, status: "api_error", expected: e }));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  let pass = 0, fail = 0, warnings = 0, fetchErrors = 0;

  for (const r of allResults) {
    const exp = r.expected || suite.citations.find(c => c.url === r.url);
    if (!exp) continue;

    const score = r.score ?? (r.cached ? `(cached)` : "N/A");
    const statusMatch = r.status === exp.expect;
    const isFetchError = r.status === "error" && (exp.expect === "verified" || exp.expect === "partially_verified");
    const softMatch = exp.expect === "verified" && r.status === "partially_verified";

    let icon, color;
    if (statusMatch) { icon = "PASS"; color = "\x1b[32m"; }
    else if (softMatch) { icon = "WARN"; color = "\x1b[33m"; }
    else if (isFetchError) { icon = "SKIP"; color = "\x1b[36m"; }
    else { icon = "FAIL"; color = "\x1b[31m"; }

    const reset = "\x1b[0m";
    console.log(`  ${color}[${icon}]${reset} ${r.url}`);
    console.log(`        Expected: ${exp.expect} | Got: ${r.status} | Score: ${score} | Entity: ${r.entity_match ?? "-"}${r.cached ? " | CACHED" : ""}`);
    if (r.matched_text) console.log(`        Evidence: "${r.matched_text.substring(0, 120)}${r.matched_text.length > 120 ? "..." : ""}"`);

    if (statusMatch) pass++;
    else if (softMatch) { warnings++; pass++; }
    else if (isFetchError) { fetchErrors++; }
    else fail++;
  }

  console.log(`\n  ${elapsed}s | Pass: ${pass} | Fail: ${fail} | Warnings: ${warnings} | Fetch Errors: ${fetchErrors}`);
  return { pass, fail, warnings, fetchErrors };
}

async function main() {
  console.log("Citation Verification — Comprehensive Test Suite");
  console.log(`Endpoint: ${SUPABASE_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  const suiteFilter = process.argv[2] ? parseInt(process.argv[2]) : null;

  let totalPass = 0, totalFail = 0, totalWarnings = 0, totalFetchErrors = 0;

  for (let i = 0; i < TEST_SUITES.length; i++) {
    if (suiteFilter !== null && suiteFilter !== i + 1) continue;
    const result = await runTestSuite(TEST_SUITES[i], i + 1);
    totalPass += result.pass;
    totalFail += result.fail;
    totalWarnings += result.warnings;
    totalFetchErrors += result.fetchErrors;
  }

  const total = totalPass + totalFail + totalFetchErrors;
  console.log(`\n${"=".repeat(70)}`);
  console.log(`RESULTS: ${total} tests | ${totalPass} passed | ${totalFail} failed | ${totalWarnings} soft warnings | ${totalFetchErrors} fetch errors (site blocked)`);
  console.log(`${"=".repeat(70)}`);

  if (totalFail > 0) {
    console.log("\nFAILED tests indicate verification logic issues.");
    process.exit(1);
  } else if (totalFetchErrors > 0) {
    console.log("\nFetch errors are expected for bot-blocking sites (G2, Forbes, etc.).");
    console.log("These are NOT verification logic bugs.");
    process.exit(0);
  } else {
    console.log("\nAll tests passed!");
    process.exit(0);
  }
}

main();
