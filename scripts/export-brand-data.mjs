import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const SUPABASE_URL = 'https://bvmwnxargzlfheiwyget.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bXdueGFyZ3psZmhlaXd5Z2V0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODAyNjUyOCwiZXhwIjoyMDgzNjAyNTI4fQ.fnjNXJFnTxJhsBUltOFDiyuLbNEt6iEiFy01fmxcT4U';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TARGET_BRANDS = [
  'Jove', 'Nike', 'Craveda', 'Spoda AI', 'Aashirvaad',
  'Emeritus', 'Care Hospitals', 'Shriram Finance', 'Remit2Any',
  'Aspectly.ai', 'ICFAI', 'Klaviyo', 'Theyn', 'Jukshio', 'Fiska.ai'
];

// Location code → name map (common ones)
const LOCATION_MAP = {
  2840: 'United States',
  2356: 'India',
  2826: 'United Kingdom',
  2036: 'Australia',
  2124: 'Canada',
  2276: 'Germany',
  2250: 'France',
};

function formatAuditDate(dateStr) {
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}-${mm}-${yy}`;
}

async function main() {
  console.log('Fetching clients...');

  // 1. Get all clients matching target brands (by name or brand_name)
  const { data: clients, error: clientErr } = await supabase
    .from('clients')
    .select('id, name, brand_name, brand_domain, industry, location_code, target_region')
    .or(
      TARGET_BRANDS.map(b => `name.ilike.%${b}%,brand_name.ilike.%${b}%`).join(',')
    );

  if (clientErr) {
    console.error('Error fetching clients:', clientErr);
    process.exit(1);
  }

  console.log(`Found ${clients.length} matching clients:`, clients.map(c => c.brand_name || c.name));

  if (clients.length === 0) {
    console.log('No clients found. Writing empty result.');
    writeFileSync('brand-report-data.json', JSON.stringify([], null, 2));
    return;
  }

  const clientIds = clients.map(c => c.id);
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));

  // 2. Get ALL audit results via pagination
  console.log('Fetching audit results (paginated)...');
  const audits = [];
  const PAGE_SIZE = 1000;
  let page = 0;
  while (true) {
    const { data, error: auditErr } = await supabase
      .from('audit_results')
      .select('id, client_id, prompt_text, model_results, created_at, summary')
      .in('client_id', clientIds)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (auditErr) {
      console.error('Error fetching audit results:', auditErr);
      process.exit(1);
    }
    if (!data || data.length === 0) break;
    audits.push(...data);
    console.log(`  Page ${page + 1}: ${data.length} rows (total so far: ${audits.length})`);
    if (data.length < PAGE_SIZE) break;
    page++;
  }

  console.log(`Found ${audits.length} audit results total.`);

  const output = [];

  for (const audit of audits) {
    const client = clientMap[audit.client_id];
    if (!client) continue;

    const brandName = client.brand_name || client.name;
    const locationCode = client.location_code || null;
    const locationName = LOCATION_MAP[locationCode] || client.target_region || null;

    const modelResults = Array.isArray(audit.model_results) ? audit.model_results : [];

    if (modelResults.length === 0) {
      // No model results, still emit one record with nulls
      output.push({
        brandName,
        brandDomain: client.brand_domain || null,
        industry: client.industry || null,
        promptText: audit.prompt_text,
        modelId: null,
        auditDate: formatAuditDate(audit.created_at),
        locationName,
        locationCode,
        rawResponse: null,
        success: false,
        apiCost: null,
        responseTimeMs: null,
        error: 'No model results',
        createdAt: audit.created_at,
      });
    } else {
      for (const mr of modelResults) {
        output.push({
          brandName,
          brandDomain: client.brand_domain || null,
          industry: client.industry || null,
          promptText: audit.prompt_text,
          modelId: mr.model || mr.model_id || null,
          auditDate: formatAuditDate(audit.created_at),
          locationName,
          locationCode,
          rawResponse: mr.response || mr.raw_response || mr.content || null,
          success: mr.error ? false : true,
          apiCost: mr.cost ?? mr.api_cost ?? null,
          responseTimeMs: mr.response_time_ms ?? mr.latency ?? null,
          error: mr.error || null,
          createdAt: audit.created_at,
        });
      }
    }
  }

  console.log(`Total records: ${output.length}`);

  writeFileSync('brand-report-data.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log('Written to brand-report-data.json');

  // Also write a summary
  const byBrand = {};
  for (const r of output) {
    byBrand[r.brandName] = (byBrand[r.brandName] || 0) + 1;
  }
  console.log('\nRecords per brand:');
  for (const [brand, count] of Object.entries(byBrand)) {
    console.log(`  ${brand}: ${count}`);
  }

  const foundBrands = new Set(Object.keys(byBrand));
  const missing = TARGET_BRANDS.filter(b => !foundBrands.has(b) && ![...foundBrands].some(f => f.toLowerCase().includes(b.toLowerCase())));
  if (missing.length) {
    console.log('\nBrands NOT found in database:', missing);
  }
}

main().catch(console.error);
