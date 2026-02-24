const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN || "";
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD || "";
const DATAFORSEO_AUTH = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
const DATAFORSEO_API = "https://api.dataforseo.com/v3";

async function callDataForSEO(endpoint, body, method = "POST") {
    try {
        const url = `${DATAFORSEO_API}${endpoint}`;
        const options = {
            method: method,
            headers: {
                "Authorization": `Basic ${DATAFORSEO_AUTH}`,
                "Content-Type": "application/json",
            }
        };
        if (body && method === "POST") {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        const text = await response.text();
        const data = JSON.parse(text);
        return data;
    } catch (err) {
        console.error(`Exception: ${err}`);
    }
}

async function testScraper(locationCode) {
    console.log(`\n--- Testing ChatGPT Scraper with Location Code: ${locationCode} ---`);
    const payload = {
        keyword: "Best coffee shops in Bangalore",
        location_code: locationCode,
        language_code: "en",
        force_web_search: true
    };

    const endpoint = "/ai_optimization/chat_gpt/llm_scraper/live/advanced";
    const result = await callDataForSEO(endpoint, [payload]);
    if (result && result.tasks && result.tasks[0]) {
        console.log(`Result: ${result.tasks[0].status_message} (Code: ${result.tasks[0].status_code})`);
        if (result.tasks[0].status_code === 40501) {
            console.log("Error details:", JSON.stringify(result.tasks[0], null, 2));
        }
    }
}

async function getScraperLocations() {
    console.log("\n--- Fetching ChatGPT Scraper Locations ---");
    const result = await callDataForSEO("/ai_optimization/chat_gpt/llm_scraper/locations", null, "GET");
    if (result && result.tasks && result.tasks[0] && result.tasks[0].result) {
        const locations = result.tasks[0].result;
        console.log(`Found ${locations.length} locations.`);
        const sample = locations.slice(0, 5);
        console.log("Sample locations:", JSON.stringify(sample, null, 2));

        const hasBangalore = locations.find(l => l.location_name && l.location_name.toLowerCase().includes("bangalore"));
        console.log("Bangalore in locations?", hasBangalore ? `YES (Code: ${hasBangalore.location_code})` : "NO");
    }
}

async function main() {
    console.log("--- STARTING SCRAPER TESTS ---");
    // Test with the problematic code from logs
    await testScraper(1027351);
    // Test with a known country code
    await testScraper(2356); // India
    // Check available locations
    await getScraperLocations();
    console.log("--- SCRAPER TESTS FINISHED ---");
}

main();
