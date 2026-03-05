// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const supabaseUrl = 'https://bvmwnxargzlfheiwyget.supabase.co'
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function testGA4Data() {
    console.log("🚀 Starting GA4 Data Verification Test...")

    // 1. Get the latest integration
    const { data: integrations, error: intError } = await supabase
        .from('ga4_integrations')
        .select('*')
        .eq('status', 'connected')
        .limit(1)

    if (intError || !integrations || integrations.length === 0) {
        console.error("❌ No connected GA4 integrations found in database.")
        return
    }

    const integration = integrations[0]
    console.log(`✅ Found integration for client: ${integration.client_id}`)
    console.log(`📡 Property: ${integration.ga4_property_id}, Stream: ${integration.ga4_stream_id}`)

    // 2. Directly call the ga4-sync edge function
    console.log("🔄 Triggering ga4-sync edge function...")
    const { data: syncResult, error: syncError } = await supabase.functions.invoke('ga4-sync', {
        body: { client_id: integration.client_id }
    })

    if (syncError) {
        console.error("❌ Sync function failed:", syncError)
    } else {
        console.log("✅ Sync function completed successfully.")
        console.log("📊 Sync Result Summary:", syncResult)
    }

    // 3. Check for any sync logs with data
    const { data: logs, error: logError } = await supabase
        .from('ga4_sync_logs')
        .select('*')
        .eq('client_id', integration.client_id)
        .order('sync_date', { ascending: false })
        .limit(10)

    if (logError) {
        console.error("❌ Failed to fetch sync logs:", logError)
    } else if (logs && logs.length > 0) {
        console.log(`📈 Found ${logs.length} sync logs.`)
        const totalSessions = logs.reduce((sum: number, log: any) => sum + (log.sessions || 0), 0)
        console.log(`✨ Total LLM Sessions found in logs: ${totalSessions}`)

        if (totalSessions === 0) {
            console.warn("⚠️  All logs show 0 sessions. This likely means no traffic from LLM sources (ChatGPT, Perplexity, etc.) has been recorded in GA4 yet.")
        } else {
            console.log("🎉 SUCCESS: Data is flowing!")
        }
    } else {
        console.warn("⚠️  No sync logs found for this client.")
    }
}

testGA4Data()
