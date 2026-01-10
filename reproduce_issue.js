const DATAFORSEO_LOGIN = "contact@forzeo.com";
const DATAFORSEO_PASSWORD = "b00e21651e5fab03";
const DATAFORSEO_AUTH = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');
const DATAFORSEO_API = "https://api.dataforseo.com/v3";

async function callDataForSEO(endpoint, body) {
    console.log(`[DataForSEO] POST ${endpoint}`);
    try {
        const response = await fetch(`${DATAFORSEO_API}${endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${DATAFORSEO_AUTH}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);

        try {
            const data = JSON.parse(text);
            return data;
        } catch (e) {
            return { error: 'Parse Error', text };
        }

    } catch (err) {
        console.error(`Exception: ${err}`);
    }
}

async function test() {
    const prompt = "test";

    // Test ChatGPT with gpt-4.1-mini
    console.log('\n--- Testing ChatGPT with gpt-4.1-mini ---');
    let result = await callDataForSEO("/ai_optimization/chat_gpt/llm_responses/live", [{
        user_prompt: prompt,
        model_name: "gpt-4.1-mini",
        max_output_tokens: 1000,
        temperature: 0.7,
    }]);

    if (result) {
        if (result.tasks && result.tasks[0]) {
            console.log('Task Status Message:', result.tasks[0].status_message);
            console.log('Task Status Code:', result.tasks[0].status_code);
        } else {
            console.log('Result:', JSON.stringify(result, null, 2));
        }
    }
}

test();
