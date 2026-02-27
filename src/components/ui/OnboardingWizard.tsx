import { useState, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Globe, Target, Zap, Lightbulb, AlertCircle, CheckCircle2, ChevronRight, X, Info } from 'lucide-react';
import { cn } from "@/lib/utils";

// Types
interface OnboardingWizardProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onComplete: (newClientId?: string) => void;
}

type Step = 'brand_details' | 'competitors' | 'seed_keywords' | 'review_prompts' | 'processing';
type UserRole = 'user' | 'agency' | 'admin';

interface FormData {
    brandName: string;
    website: string;
    industry: string;
    customIndustry: string;
    location: string;
    competitors: string[];
    seedKeywords: string[];
    businessType: string;
    competitorUrls: Record<string, string>;
}

// Role-based limits
const ROLE_LIMITS: Record<UserRole, { maxPrompts: number; maxKeywords: number; promptsPerKeyword: number }> = {
    user: { maxPrompts: 15, maxKeywords: 3, promptsPerKeyword: 5 },      // 3 keywords x 5 = 15 prompts max
    agency: { maxPrompts: 75, maxKeywords: 15, promptsPerKeyword: 5 },  // 15 keywords x 5 = 75 prompts max
    admin: { maxPrompts: 500, maxKeywords: 100, promptsPerKeyword: 5 }  // No practical limit
};

// Industries
const INDUSTRIES = [
    "SaaS & Technology", "E-commerce", "Healthcare", "Finance",
    "Real Estate", "Travel & Hospitality", "Legal Services", "Education",
    "Marketing Agency", "Manufacturing", "Automotive", "Food & Beverage",
    "Fashion & Retail", "Media & Entertainment", "Consulting", "Non-profit",
    "Government", "Energy & Utilities", "Construction", "Agriculture",
    "Sports & Fitness", "Beauty & Cosmetics", "Telecommunications",
    "Insurance", "Banking", "Investment", "Cryptocurrency", "Gaming",
    "Dating/Matrimony", "Pet Services", "Home Services", "B2B Services",
    "Custom"
];

// Comprehensive World Locations
const LOCATIONS = [
    // === GLOBAL ===
    { code: "GLOBAL", name: "🌍 Global / Worldwide", category: "Global" },

    // === CONTINENTS ===
    { code: "CONT_NA", name: "🌎 North America", category: "Continents" },
    { code: "CONT_EU", name: "🌍 Europe", category: "Continents" },
    { code: "CONT_AS", name: "🌏 Asia", category: "Continents" },
    { code: "CONT_SA", name: "🌎 South America", category: "Continents" },
    { code: "CONT_AF", name: "🌍 Africa", category: "Continents" },
    { code: "CONT_OC", name: "🌏 Oceania", category: "Continents" },

    // === NORTH AMERICA ===
    { code: "US", name: "🇺🇸 United States", category: "North America" },
    { code: "CA", name: "🇨🇦 Canada", category: "North America" },
    { code: "MX", name: "🇲🇽 Mexico", category: "North America" },

    // === US CITIES ===
    { code: "US_NY", name: "🗽 New York, USA", category: "US Cities" },
    { code: "US_LA", name: "🌴 Los Angeles, USA", category: "US Cities" },
    { code: "US_CHI", name: "🏙️ Chicago, USA", category: "US Cities" },
    { code: "US_HOU", name: "🤠 Houston, USA", category: "US Cities" },
    { code: "US_PHX", name: "🌵 Phoenix, USA", category: "US Cities" },
    { code: "US_SF", name: "🌉 San Francisco, USA", category: "US Cities" },
    { code: "US_SEA", name: "☕ Seattle, USA", category: "US Cities" },
    { code: "US_MIA", name: "🏖️ Miami, USA", category: "US Cities" },
    { code: "US_BOS", name: "🦞 Boston, USA", category: "US Cities" },
    { code: "US_DEN", name: "⛰️ Denver, USA", category: "US Cities" },
    { code: "US_ATL", name: "🍑 Atlanta, USA", category: "US Cities" },
    { code: "US_DAL", name: "⛳ Dallas, USA", category: "US Cities" },
    { code: "US_AUS", name: "🎸 Austin, USA", category: "US Cities" },
    { code: "US_LV", name: "🎰 Las Vegas, USA", category: "US Cities" },

    // === EUROPE ===
    { code: "GB", name: "🇬🇧 United Kingdom", category: "Europe" },
    { code: "DE", name: "🇩🇪 Germany", category: "Europe" },
    { code: "FR", name: "🇫🇷 France", category: "Europe" },
    { code: "IT", name: "🇮🇹 Italy", category: "Europe" },
    { code: "ES", name: "🇪🇸 Spain", category: "Europe" },
    { code: "NL", name: "🇳🇱 Netherlands", category: "Europe" },
    { code: "CH", name: "🇨🇭 Switzerland", category: "Europe" },
    { code: "SE", name: "🇸🇪 Sweden", category: "Europe" },
    { code: "NO", name: "🇳🇴 Norway", category: "Europe" },
    { code: "DK", name: "🇩🇰 Denmark", category: "Europe" },
    { code: "FI", name: "🇫🇮 Finland", category: "Europe" },
    { code: "PL", name: "🇵🇱 Poland", category: "Europe" },
    { code: "AT", name: "🇦🇹 Austria", category: "Europe" },
    { code: "BE", name: "🇧🇪 Belgium", category: "Europe" },
    { code: "PT", name: "🇵🇹 Portugal", category: "Europe" },
    { code: "IE", name: "🇮🇪 Ireland", category: "Europe" },
    { code: "GR", name: "🇬🇷 Greece", category: "Europe" },
    { code: "CZ", name: "🇨🇿 Czech Republic", category: "Europe" },
    { code: "RO", name: "🇷🇴 Romania", category: "Europe" },
    { code: "HU", name: "🇭🇺 Hungary", category: "Europe" },
    { code: "UA", name: "🇺🇦 Ukraine", category: "Europe" },
    { code: "RU", name: "🇷🇺 Russia", category: "Europe" },

    // === UK CITIES ===
    { code: "GB_LON", name: "🏰 London, UK", category: "UK Cities" },
    { code: "GB_MAN", name: "⚽ Manchester, UK", category: "UK Cities" },
    { code: "GB_BIR", name: "🏭 Birmingham, UK", category: "UK Cities" },
    { code: "GB_EDI", name: "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Edinburgh, UK", category: "UK Cities" },
    { code: "GB_GLA", name: "🏴󠁧󠁢󠁳󠁣󠁴󠁿 Glasgow, UK", category: "UK Cities" },

    // === ASIA PACIFIC ===
    { code: "JP", name: "🇯🇵 Japan", category: "Asia Pacific" },
    { code: "KR", name: "🇰🇷 South Korea", category: "Asia Pacific" },
    { code: "CN", name: "🇨🇳 China", category: "Asia Pacific" },
    { code: "HK", name: "🇭🇰 Hong Kong", category: "Asia Pacific" },
    { code: "TW", name: "🇹🇼 Taiwan", category: "Asia Pacific" },
    { code: "IN", name: "🇮🇳 India", category: "Asia Pacific" },
    { code: "SG", name: "🇸🇬 Singapore", category: "Asia Pacific" },
    { code: "TH", name: "🇹🇭 Thailand", category: "Asia Pacific" },
    { code: "MY", name: "🇲🇾 Malaysia", category: "Asia Pacific" },
    { code: "ID", name: "🇮🇩 Indonesia", category: "Asia Pacific" },
    { code: "PH", name: "🇵🇭 Philippines", category: "Asia Pacific" },
    { code: "VN", name: "🇻🇳 Vietnam", category: "Asia Pacific" },
    { code: "AU", name: "🇦🇺 Australia", category: "Asia Pacific" },
    { code: "NZ", name: "🇳🇿 New Zealand", category: "Asia Pacific" },
    { code: "PK", name: "🇵🇰 Pakistan", category: "Asia Pacific" },
    { code: "BD", name: "🇧🇩 Bangladesh", category: "Asia Pacific" },

    // === INDIA CITIES ===
    { code: "IN_MUM", name: "🏙️ Mumbai, India", category: "India Cities" },
    { code: "IN_DEL", name: "🕌 Delhi, India", category: "India Cities" },
    { code: "IN_BLR", name: "💻 Bangalore, India", category: "India Cities" },
    { code: "IN_HYD", name: "🏛️ Hyderabad, India", category: "India Cities" },
    { code: "IN_CHE", name: "🏖️ Chennai, India", category: "India Cities" },
    { code: "IN_KOL", name: "🌉 Kolkata, India", category: "India Cities" },
    { code: "IN_PUN", name: "🏔️ Pune, India", category: "India Cities" },
    { code: "IN_AMD", name: "🏭 Ahmedabad, India", category: "India Cities" },

    // === MIDDLE EAST ===
    { code: "AE", name: "🇦🇪 UAE", category: "Middle East" },
    { code: "SA", name: "🇸🇦 Saudi Arabia", category: "Middle East" },
    { code: "IL", name: "🇮🇱 Israel", category: "Middle East" },
    { code: "QA", name: "🇶🇦 Qatar", category: "Middle East" },
    { code: "KW", name: "🇰🇼 Kuwait", category: "Middle East" },
    { code: "BH", name: "🇧🇭 Bahrain", category: "Middle East" },
    { code: "OM", name: "🇴🇲 Oman", category: "Middle East" },
    { code: "EG", name: "🇪🇬 Egypt", category: "Middle East" },
    { code: "TR", name: "🇹🇷 Turkey", category: "Middle East" },

    // === UAE CITIES ===
    { code: "AE_DXB", name: "🏙️ Dubai, UAE", category: "UAE Cities" },
    { code: "AE_AUH", name: "🕌 Abu Dhabi, UAE", category: "UAE Cities" },

    // === SOUTH AMERICA ===
    { code: "BR", name: "🇧🇷 Brazil", category: "South America" },
    { code: "AR", name: "🇦🇷 Argentina", category: "South America" },
    { code: "CO", name: "🇨🇴 Colombia", category: "South America" },
    { code: "CL", name: "🇨🇱 Chile", category: "South America" },
    { code: "PE", name: "🇵🇪 Peru", category: "South America" },

    // === AFRICA ===
    { code: "ZA", name: "🇿🇦 South Africa", category: "Africa" },
    { code: "NG", name: "🇳🇬 Nigeria", category: "Africa" },
    { code: "KE", name: "🇰🇪 Kenya", category: "Africa" },
    { code: "MA", name: "🇲🇦 Morocco", category: "Africa" },
    { code: "GH", name: "🇬🇭 Ghana", category: "Africa" },
];

// Location code mapping for DataForSEO
const LOCATION_CODE_MAP: Record<string, number> = {
    // Global/Continents (use US as default)
    "GLOBAL": 2840, "CONT_NA": 2840, "CONT_EU": 2826, "CONT_AS": 2356,
    "CONT_SA": 2076, "CONT_AF": 2710, "CONT_OC": 2036,
    // Countries
    "US": 2840, "CA": 2124, "MX": 2484, "GB": 2826, "DE": 2276, "FR": 2250,
    "IT": 2380, "ES": 2724, "NL": 2528, "CH": 2756, "SE": 2752, "NO": 2578,
    "DK": 2208, "FI": 2246, "PL": 2616, "AT": 2040, "BE": 2056, "PT": 2620,
    "IE": 2372, "GR": 2300, "CZ": 2203, "RO": 2642, "HU": 2348, "UA": 2804, "RU": 2643,
    "JP": 2392, "KR": 2410, "CN": 2156, "HK": 2344, "TW": 2158, "IN": 2356,
    "SG": 2702, "TH": 2764, "MY": 2458, "ID": 2360, "PH": 2608, "VN": 2704,
    "AU": 2036, "NZ": 2554, "PK": 2586, "BD": 2050,
    "AE": 2784, "SA": 2682, "IL": 2376, "QA": 2634, "KW": 2414, "BH": 2048,
    "OM": 2512, "EG": 2818, "TR": 2792,
    "BR": 2076, "AR": 2032, "CO": 2170, "CL": 2152, "PE": 2604,
    "ZA": 2710, "NG": 2566, "KE": 2404, "MA": 2504, "GH": 2288,
    // US Cities
    "US_NY": 1023191, "US_LA": 1013962, "US_CHI": 1016367, "US_HOU": 1026481,
    "US_PHX": 1023564, "US_SF": 1014221, "US_SEA": 1027744, "US_MIA": 1015116,
    "US_BOS": 1018127, "US_DEN": 1014395, "US_ATL": 1015254, "US_DAL": 1026339,
    "US_AUS": 1026135, "US_LV": 1023163,
    // UK Cities
    "GB_LON": 1006886, "GB_MAN": 1006977, "GB_BIR": 1006632, "GB_EDI": 1006789, "GB_GLA": 1006822,
    // India Cities
    "IN_MUM": 1007788, "IN_DEL": 1007768, "IN_BLR": 1007751, "IN_HYD": 1007774,
    "IN_CHE": 1007762, "IN_KOL": 1007780, "IN_PUN": 1007793, "IN_AMD": 1007747,
    // UAE Cities
    "AE_DXB": 1013010, "AE_AUH": 1013002,
};

export function OnboardingWizard({ open, onOpenChange, onComplete }: OnboardingWizardProps) {
    const [currentStep, setCurrentStep] = useState<Step>('brand_details');
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [userRole, setUserRole] = useState<UserRole>('user');
    const [userLimits, setUserLimits] = useState(ROLE_LIMITS.user);

    // Form Data with localStorage backup
    const [formData, setFormData] = useState<FormData>(() => {
        const defaults: FormData = {
            brandName: '', website: '', industry: '', customIndustry: '', businessType: 'Online Business',
            location: 'US', competitors: [], seedKeywords: [], competitorUrls: {}
        };
        try {
            const saved = localStorage.getItem('onboarding_form_data');
            if (saved) {
                const parsed = JSON.parse(saved);
                return { ...defaults, ...parsed, competitorUrls: parsed.competitorUrls || {} };
            }
        } catch (e) {
            console.warn("[Onboarding] localStorage error:", e);
            // If error, clear it to prevent stuck state
            try { localStorage.removeItem('onboarding_form_data'); } catch { }
        }
        return defaults;
    });

    // Fetch user role on mount
    useEffect(() => {
        const fetchUserRole = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', user.id)
                        .single();
                    const role = (profile?.role || 'user') as UserRole;
                    setUserRole(role);
                    setUserLimits(ROLE_LIMITS[role] || ROLE_LIMITS.user);
                }
            } catch (e) { console.error("Error fetching user role:", e); }
        };
        if (open) fetchUserRole();
    }, [open]);

    // Save form data to localStorage (with quota protection)
    useEffect(() => {
        if (formData.brandName || formData.website || formData.competitors.length > 0 || formData.seedKeywords.length > 0) {
            try {
                localStorage.setItem('onboarding_form_data', JSON.stringify(formData));
            } catch (err: any) {
                if (err?.name === 'QuotaExceededError' || err?.code === 22) {
                    console.warn('[Onboarding] localStorage full, clearing old cache...');
                    try {
                        // Clear the heaviest keys to free space
                        localStorage.removeItem('forzeo_audit_results_v3');
                        localStorage.removeItem('forzeo_prompts_v3');
                        localStorage.removeItem('forzeo_clients_v3');
                        localStorage.setItem('onboarding_form_data', JSON.stringify(formData));
                    } catch { /* silently fail — form state is in React memory anyway */ }
                }
            }
        }
    }, [formData]);

    const [newKeyword, setNewKeyword] = useState('');
    const [newCompetitor, setNewCompetitor] = useState('');
    const [newCompetitorUrl, setNewCompetitorUrl] = useState('');
    const [autoFindingCompetitors, setAutoFindingCompetitors] = useState(false);
    const [promptsPerKeyword, setPromptsPerKeyword] = useState(5); // User selectable: 3-10
    const [processingProgress, setProcessingProgress] = useState(0);
    const [processingStatus, setProcessingStatus] = useState('');
    const [generatedPrompts, setGeneratedPrompts] = useState<{ text: string, topic: string }[]>([]);
    const [newManualPrompt, setNewManualPrompt] = useState("");
    const [locationSearch, setLocationSearch] = useState(""); // For searchable location field

    // Reset form
    const resetForm = useCallback(() => {
        setCurrentStep('brand_details');
        setFormData({
            brandName: '', website: '', industry: '', customIndustry: '', businessType: 'Online Business',
            location: 'US', competitors: [], seedKeywords: [], competitorUrls: {}
        });
        setNewKeyword('');
        setNewCompetitor('');
        setNewCompetitorUrl('');
        setNotification(null);
        setLoading(false);
        setAutoFindingCompetitors(false);
        localStorage.removeItem('onboarding_form_data');
    }, []);

    // Show temp notification
    const showNotification = useCallback((type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    }, []);

    // Form handlers
    const handleBrandNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, brandName: e.target.value }));
    }, []);

    const handleWebsiteChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, website: e.target.value }));
    }, []);

    const handleCustomIndustryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, customIndustry: e.target.value }));
    }, []);

    const handleIndustryChange = useCallback((value: string) => {
        setFormData(prev => ({ ...prev, industry: value, customIndustry: value === 'Custom' ? prev.customIndustry : '' }));
    }, []);

    const handleLocationChange = useCallback((value: string) => {
        setFormData(prev => ({ ...prev, location: value }));
    }, []);

    // Competitor handlers
    const handleAddCompetitor = useCallback(() => {
        const trimmed = newCompetitor.trim();
        if (trimmed && trimmed.length >= 2 && !formData.competitors.includes(trimmed)) {
            setFormData(prev => ({
                ...prev,
                competitors: [...prev.competitors, trimmed],
                competitorUrls: { ...prev.competitorUrls, [trimmed]: newCompetitorUrl.trim() }
            }));
            setNewCompetitor('');
            setNewCompetitorUrl('');
        }
    }, [newCompetitor, newCompetitorUrl, formData.competitors]);

    const handleRemoveCompetitor = useCallback((index: number) => {
        setFormData(prev => ({ ...prev, competitors: prev.competitors.filter((_, i) => i !== index) }));
    }, []);

    const handleCompetitorKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddCompetitor(); }
    }, [handleAddCompetitor]);

    // Keyword handlers with quota check (supports comma-separated input)
    const handleAddKeyword = useCallback(() => {
        const input = newKeyword.trim();
        if (!input) return;

        // Split by commas and process each keyword
        const keywords = input
            .split(',')
            .map(kw => kw.trim())
            .filter(kw => kw.length >= 3); // Filter out empty or too short keywords

        if (keywords.length === 0) {
            showNotification('error', 'Keywords must be at least 3 characters long.');
            return;
        }

        // Check for duplicates and quota
        const newKeywords: string[] = [];
        const duplicates: string[] = [];
        let quotaExceeded = false;

        for (const keyword of keywords) {
            if (formData.seedKeywords.includes(keyword) || newKeywords.includes(keyword)) {
                duplicates.push(keyword);
            } else if (formData.seedKeywords.length + newKeywords.length >= userLimits.maxKeywords) {
                quotaExceeded = true;
                break;
            } else {
                newKeywords.push(keyword);
            }
        }

        // Add valid keywords
        if (newKeywords.length > 0) {
            setFormData(prev => ({ ...prev, seedKeywords: [...prev.seedKeywords, ...newKeywords] }));
            setNewKeyword('');

            if (newKeywords.length > 1) {
                showNotification('success', `Added ${newKeywords.length} keywords successfully!`);
            }
        }

        // Show warnings if needed
        if (duplicates.length > 0) {
            showNotification('error', `Skipped duplicate keyword${duplicates.length > 1 ? 's' : ''}: ${duplicates.join(', ')}`);
        }
        if (quotaExceeded) {
            showNotification('error', `Keyword limit reached (${userLimits.maxKeywords} max for ${userRole}). Added ${newKeywords.length} keyword${newKeywords.length !== 1 ? 's' : ''}.`);
        }
    }, [newKeyword, formData.seedKeywords, userLimits.maxKeywords, userRole, showNotification]);

    const handleRemoveKeyword = useCallback((index: number) => {
        setFormData(prev => ({ ...prev, seedKeywords: prev.seedKeywords.filter((_, i) => i !== index) }));
    }, []);

    const handleKeywordKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddKeyword(); }
    }, [handleAddKeyword]);

    // Auto-find competitors via Groq + Tavily
    const handleAutoFindCompetitors = useCallback(async () => {
        if (!formData.brandName || !formData.industry) {
            showNotification('error', "Please enter brand name and industry first.");
            return;
        }

        setAutoFindingCompetitors(true);
        try {
            const finalIndustry = formData.industry === 'Custom' ? formData.customIndustry : formData.industry;
            const locationName = LOCATIONS.find(l => l.code === formData.location)?.name?.replace(/^[^\s]+\s/, '') || 'United States';

            let competitors: string[] = [];

            // Step 1: Try Tavily search for real-time competitor data
            let tavilyContext = "";
            try {
                console.log("[Auto-Find] Step 1: Searching with Tavily...");
                const { data, error } = await supabase.functions.invoke("tavily-search", {
                    body: {
                        query: `top competitors of ${formData.brandName} in ${finalIndustry} industry ${locationName}`,
                        search_depth: "basic",
                        max_results: 5
                    }
                });
                if (!error && data?.results) {
                    tavilyContext = data.results.map((r: { title?: string; url?: string }) => `${r.title} - ${r.url}`).join("\n");
                    console.log("[Auto-Find] Tavily found context:", tavilyContext);
                }
            } catch (e) {
                console.warn("[Auto-Find] Tavily search failed:", e);
            }

            // Step 2: Use groq-proxy to extract/generate competitors
            console.log("[Auto-Find] Step 2: Using groq-proxy to find competitors...");
            const groqPrompt = tavilyContext
                ? `Based on this search data about ${formData.brandName} competitors:\n${tavilyContext}\n\nExtract 5 direct competitor company names for "${formData.brandName}" in the "${finalIndustry}" industry. Return ONLY a JSON array like ["Comp1", "Comp2"].`
                : `Find 5 direct competitors for "${formData.brandName}" in the "${finalIndustry}" industry in ${locationName}. Return ONLY a JSON array like ["Comp1", "Comp2", "Comp3", "Comp4", "Comp5"]`;

            const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
                body: {
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "You are a market research expert. Return ONLY a JSON array of competitor company names. No explanations, no markdown, just the JSON array." },
                        { role: "user", content: groqPrompt }
                    ],
                    temperature: 0.1,
                    max_tokens: 300,
                },
            });

            if (!proxyError && proxyData?.response) {
                const content = proxyData.response;
                console.log("[Auto-Find] groq-proxy response:", content);
                try {
                    const jsonMatch = content.match(/\[[\s\S]*?\]/);
                    if (jsonMatch) {
                        competitors = JSON.parse(jsonMatch[0]);
                    }
                } catch (e) {
                    console.warn("[Auto-Find] Parse error:", e);
                }
            } else if (proxyError) {
                console.error("[Auto-Find] groq-proxy error:", proxyError);
            }

            if (competitors.length > 0) {
                const found = competitors.map(String).filter((n: string) => n && n.length > 1 && n.toLowerCase() !== formData.brandName.toLowerCase()).slice(0, 5);
                if (found.length > 0) {
                    setFormData(prev => ({ ...prev, competitors: [...new Set([...prev.competitors, ...found])] }));
                    showNotification('success', `Found ${found.length} potential competitors!`);
                    return;
                }
            }
            throw new Error("Could not find competitors");
        } catch (error) {
            console.error("[Auto-Find] Failed:", error);
            showNotification('error', error instanceof Error ? error.message : "Could not auto-find competitors. Please add manually.");
        } finally {
            setAutoFindingCompetitors(false);
        }
    }, [formData.brandName, formData.industry, formData.customIndustry, formData.location, showNotification]);

    // Location drilldown helper for granular geo-context
    const getLocationDrilldown = useCallback((region: string): string => {
        const geographyMap: Record<string, string[]> = {
            "India": ["Mumbai", "Bangalore", "Delhi NCR"],
            "UAE": ["Dubai", "Abu Dhabi"],
            "United States": ["New York", "San Francisco", "Austin"],
            "USA": ["New York", "San Francisco", "Austin"],
            "UK": ["London", "Manchester"],
            "United Kingdom": ["London", "Manchester"],
            "Dubai": ["Dubai Marina", "Downtown Dubai", "Business Bay"],
            "Bangalore": ["Indiranagar", "Koramangala", "Whitefield"],
            "Mumbai": ["Bandra", "Lower Parel", "Andheri"],
            "Singapore": ["CBD", "Orchard Road", "Marina Bay"],
            "Australia": ["Sydney", "Melbourne", "Brisbane"],
            "Canada": ["Toronto", "Vancouver", "Montreal"],
            "Germany": ["Berlin", "Munich", "Frankfurt"],
            "France": ["Paris", "Lyon", "Marseille"],
        };
        const subLocations = geographyMap[region];
        if (subLocations) {
            return `Drill down into specific sub-locations: ${subLocations.join(", ")}.`;
        }
        return `Focus on the most prominent commercial hubs within ${region}.`;
    }, []);

    // Generate prompts via LLM (Brand-Neutral GEO Strategist)
    const handleGeneratePreview = useCallback(async () => {
        const finalIndustry = formData.industry === 'Custom' ? formData.customIndustry : formData.industry;
        const locationName = LOCATIONS.find(l => l.code === formData.location)?.name?.replace(/^[^\s]+\s/, '') || 'United States';
        const maxPromptsAllowed = userLimits.maxPrompts;
        const allPrompts: { text: string, topic: string }[] = [];

        setLoading(true);
        setCurrentStep('review_prompts');

        const locationInstruction = getLocationDrilldown(locationName);

        // GEO Strategist system prompt — Brand-Neutral Category Dominance
        const systemInstruction = `You are a Generative Engine Optimization (GEO) Strategist. Your goal is to generate high-intent search queries that real buyers use to discover top-tier solutions in a specific category.

STRICT CONSTRAINTS:
- BRAND NEUTRALITY: You must NEVER include the brand name "${formData.brandName}" in any output. Focus entirely on category-level searches (e.g., "Best [Category]" instead of "${formData.brandName} reviews").
- BUYER INTENT: Prioritize queries that indicate a user is ready to purchase or compare (Commercial Investigation).
- NO FILLER: Output ONLY the prompts, one per line. No numbers, no introductory text, no conversational filler.`;

        for (const keyword of formData.seedKeywords) {
            if (allPrompts.length >= maxPromptsAllowed) break;

            const promptsNeeded = Math.min(promptsPerKeyword, maxPromptsAllowed - allPrompts.length);

            // Dynamic user prompt for this keyword
            const userPrompt = `Category Keyword: ${keyword}
Industry: ${finalIndustry}
Region: ${locationName}

Instructions:
1. Generate ${promptsNeeded} brand-neutral search prompts.
2. ${locationInstruction}
3. Prompt Mix Requirement:
   - ${Math.max(1, Math.floor(promptsNeeded * 0.3))}x "Pillar" Queries: (Top 5, Top 10, Best of 2026).
   - ${Math.max(1, Math.floor(promptsNeeded * 0.3))}x "Localized" Queries: (Best in [City/Area]).
   - ${Math.max(1, Math.floor(promptsNeeded * 0.3))}x "Industry Variations": High-intent variations specific to ${finalIndustry} (e.g., pricing, reliability, specific technical use-cases).
   - 1x "Decision Criteria": A query asking the AI for advice on how to choose a provider in this category.
4. STOPSHIP: Do NOT mention the brand "${formData.brandName}" in any output.`;

            let generatedLines: string[] = [];

            // Try LLM generation via groq-proxy (key is server-side)
            try {
                console.log(`[GEO Onboarding] Generating prompts for keyword: "${keyword}"`);
                const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
                    body: {
                        model: "llama-3.1-8b-instant",
                        messages: [
                            { role: "system", content: systemInstruction },
                            { role: "user", content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 2048,
                    },
                });

                if (!proxyError && proxyData?.response) {
                    generatedLines = proxyData.response.split("\n")
                        .map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").replace(/^[•]\s*/, "").trim())
                        .filter((l: string) => l.length > 10 && !l.toLowerCase().includes(formData.brandName.toLowerCase()))
                        .slice(0, promptsNeeded);
                    console.log(`[GEO Onboarding] Got ${generatedLines.length} prompts for "${keyword}"`);
                } else if (proxyError) {
                    console.warn(`[GEO Onboarding] groq-proxy error:`, proxyError);
                }
            } catch (err) {
                console.error("[GEO Onboarding] groq-proxy error:", err);
            }

            // Fallback to templates if LLM failed or no API key
            if (generatedLines.length === 0) {
                console.log(`[GEO Onboarding] Falling back to templates for "${keyword}"`);
                generatedLines = [
                    `Best ${keyword} options in ${locationName} for 2026`,
                    `Top 10 ${keyword} providers compared`,
                    `How to choose the right ${keyword} for ${finalIndustry}`,
                    `Most reliable ${keyword} solutions with competitive pricing`,
                    `${keyword} recommendations for small and mid-size businesses`,
                    `Affordable ${keyword} alternatives worth considering`,
                    `Premium ${keyword} services in ${locationName}`,
                    `${keyword} features and integrations guide`,
                    `${keyword} pricing comparison and reviews`,
                    `What to look for when choosing ${keyword}`
                ].slice(0, promptsNeeded);
            }

            for (const line of generatedLines) {
                if (allPrompts.length < maxPromptsAllowed) {
                    allPrompts.push({ text: line, topic: keyword });
                }
            }

            // Small delay between keywords to avoid rate limiting
            if (formData.seedKeywords.indexOf(keyword) < formData.seedKeywords.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        setGeneratedPrompts(allPrompts);
        setLoading(false);
    }, [formData, userLimits.maxPrompts, promptsPerKeyword, getLocationDrilldown]);

    // Navigation
    const handleNext = useCallback(async () => {
        if (currentStep === 'brand_details') {
            if (!formData.brandName || !formData.website || !formData.industry) {
                showNotification('error', "Please fill in all required fields.");
                return;
            }
            if (formData.industry === 'Custom' && (!formData.customIndustry.trim() || formData.customIndustry.trim().length < 3)) {
                showNotification('error', "Please specify your custom industry (at least 3 characters).");
                return;
            }
            setCurrentStep('competitors');
            // Auto-find on step entry
            if (formData.competitors.length === 0) {
                setTimeout(() => handleAutoFindCompetitors(), 500);
            }
        } else if (currentStep === 'competitors') {
            setCurrentStep('seed_keywords');
        } else if (currentStep === 'seed_keywords') {
            if (formData.seedKeywords.length === 0) {
                showNotification('error', "Please add at least one seed keyword.");
                return;
            }
            await handleGeneratePreview();
        } else if (currentStep === 'review_prompts') {
            if (generatedPrompts.length === 0) {
                showNotification('error', "You need at least one prompt to proceed.");
                return;
            }
            handleCommit();
        }
    }, [currentStep, formData, showNotification, handleAutoFindCompetitors, generatedPrompts, handleGeneratePreview]);

    const handleBack = useCallback(() => {
        if (currentStep === 'competitors') setCurrentStep('brand_details');
        else if (currentStep === 'seed_keywords') setCurrentStep('competitors');
        else if (currentStep === 'review_prompts') setCurrentStep('seed_keywords');
    }, [currentStep]);


    const handlePromptEdit = (idx: number, newVal: string) => {
        const updated = [...generatedPrompts];
        updated[idx] = { ...updated[idx], text: newVal };
        setGeneratedPrompts(updated);
    };

    const handlePromptDelete = (idx: number) => {
        const updated = [...generatedPrompts];
        updated.splice(idx, 1);
        setGeneratedPrompts(updated);
    };

    const handleAddManualPrompt = () => {
        if (generatedPrompts.length >= userLimits.maxPrompts) {
            showNotification('error', `Limit reached: You can only have ${userLimits.maxPrompts} prompts.`);
            return;
        }
        if (newManualPrompt.trim()) {
            setGeneratedPrompts([...generatedPrompts, { text: newManualPrompt.trim(), topic: 'custom' }]);
            setNewManualPrompt("");
        }
    };

    // Commit Final Setup to DB
    const handleCommit = useCallback(async () => {
        setCurrentStep('processing');
        setLoading(true);
        setProcessingProgress(10);
        setProcessingStatus("Creating your brand profile...");

        try {
            const finalIndustry = formData.industry === 'Custom' ? formData.customIndustry : formData.industry;
            const locationName = LOCATIONS.find(l => l.code === formData.location)?.name?.replace(/^[^\s]+\s/, '') || 'United States';

            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) throw new Error("User not authenticated");

            // Create client
            const clientData = {
                id: crypto.randomUUID(),
                name: formData.brandName,
                brand_name: formData.brandName,
                brand_domain: formData.website,
                slug: formData.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
                industry: finalIndustry,
                target_region: locationName,
                location_code: LOCATION_CODE_MAP[formData.location] || 2840,
                competitors: formData.competitors,
                primary_color: '#3b82f6',

                brand_tags: [
                    formData.brandName,
                    `Type:${formData.businessType}`,
                    ...Object.entries(formData.competitorUrls).map(([name, url]) => `CompURL:${name}|${url}`)
                ]
            };

            await new Promise(r => setTimeout(r, 500));
            setProcessingProgress(30);

            const { error: clientError } = await supabase.from('clients').insert(clientData);
            if (clientError) throw new Error(`Failed to create client: ${clientError.message}`);

            const { error: assocError } = await supabase.from('user_clients').insert({
                user_id: user.id,
                client_id: clientData.id,
                granted_by: user.id
            });
            if (assocError) console.error("User-client association error:", assocError);

            setProcessingProgress(60);
            setProcessingStatus(`Saving ${generatedPrompts.length} prompts to database...`);
            await new Promise(r => setTimeout(r, 500));

            // Insert prompts
            if (generatedPrompts.length > 0) {
                const promptsData = generatedPrompts.map(p => ({
                    id: crypto.randomUUID(),
                    client_id: clientData.id,
                    prompt_text: p.text,
                    category: 'custom', // Default to custom to avoid ENUM violation
                    tags: p.topic ? [p.topic] : [],
                    is_custom: false,
                    is_active: true
                }));

                const { error: promptsError } = await supabase.from('prompts').insert(promptsData);
                if (promptsError) {
                    console.error("Prompts insert error:", promptsError);
                    toast.error(`Failed to save prompts: ${promptsError.message}`);
                }
            }

            setProcessingProgress(100);
            setProcessingStatus("Finalizing setup...");
            await new Promise(r => setTimeout(r, 500));

            showNotification('success', generatedPrompts.length > 0
                ? `Setup complete! Created ${generatedPrompts.length} prompts.`
                : "Setup complete!");

            setTimeout(() => {
                resetForm();
                onComplete(clientData.id);
                onOpenChange(false);
            }, 1000);

        } catch (error: unknown) {
            console.error("Onboarding failed:", error);
            showNotification('error', error instanceof Error ? error.message : "Setup failed. Please try again.");
            setCurrentStep('review_prompts'); // Go back to review on failure
            setProcessingProgress(0);
        } finally {
            setLoading(false);
        }
    }, [formData, generatedPrompts, onComplete, onOpenChange, showNotification, resetForm]);

    // Calculate prompts to be generated
    const promptsToGenerate = Math.min(formData.seedKeywords.length * promptsPerKeyword, userLimits.maxPrompts);
    const keywordsRemaining = userLimits.maxKeywords - formData.seedKeywords.length;

    // Step content renderer
    const renderStepContent = () => {
        switch (currentStep) {
            case 'brand_details':
                return (
                    <div className="space-y-6 py-4">
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-gray-700">Brand Name *</Label>
                            <Input placeholder="e.g. Acme Corp" value={formData.brandName} onChange={handleBrandNameChange}
                                className="h-12 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20" />
                        </div>
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-gray-700">Website URL *</Label>
                            <Input placeholder="https://example.com" value={formData.website} onChange={handleWebsiteChange}
                                className="h-12 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-gray-700">Industry *</Label>
                                <Select onValueChange={handleIndustryChange} value={formData.industry}>
                                    <SelectTrigger className="h-12 bg-white border-gray-200">
                                        <SelectValue placeholder="Select industry" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-gray-200 max-h-60">
                                        {INDUSTRIES.map(i => (
                                            <SelectItem key={i} value={i} className="text-gray-900 hover:bg-gray-100">{i}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-gray-700">Target Location *</Label>
                                {/* Search input for location */}
                                <Input
                                    placeholder="Type to search locations..."
                                    value={locationSearch}
                                    onChange={(e) => setLocationSearch(e.target.value)}
                                    className="h-10 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 mb-2"
                                />
                                <Select onValueChange={(value) => { handleLocationChange(value); setLocationSearch(""); }} value={formData.location}>
                                    <SelectTrigger className="h-12 bg-white border-gray-200">
                                        <SelectValue placeholder="Select location" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-gray-200 max-h-80">
                                        {/* Filter locations based on search */}
                                        {(() => {
                                            const searchLower = locationSearch.toLowerCase().trim();
                                            const filteredLocations = searchLower
                                                ? LOCATIONS.filter(l =>
                                                    l.name.toLowerCase().includes(searchLower) ||
                                                    l.code.toLowerCase().includes(searchLower) ||
                                                    l.category.toLowerCase().includes(searchLower)
                                                )
                                                : LOCATIONS;

                                            if (searchLower && filteredLocations.length === 0) {
                                                return <div className="px-3 py-2 text-sm text-gray-500">No locations match "{locationSearch}"</div>;
                                            }

                                            // Group by category
                                            const categories = Array.from(new Set(filteredLocations.map(l => l.category)));
                                            return categories.map(category => (
                                                <div key={category}>
                                                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50">{category}</div>
                                                    {filteredLocations.filter(l => l.category === category).map(l => (
                                                        <SelectItem key={l.code} value={l.code} className="text-gray-900 hover:bg-gray-100">{l.name}</SelectItem>
                                                    ))}
                                                </div>
                                            ));
                                        })()}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {formData.industry === 'Custom' && (
                            <div className="space-y-3">
                                <Label className="text-sm font-semibold text-gray-700">Custom Industry *</Label>
                                <Input placeholder="e.g. AI Technology, Pet Services..." value={formData.customIndustry}
                                    onChange={handleCustomIndustryChange} maxLength={100}
                                    className="h-12 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20" />

                            </div>
                        )}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-gray-700">Business Classification *</Label>
                            <Select onValueChange={(v) => setFormData(prev => ({ ...prev, businessType: v }))} value={formData.businessType}>
                                <SelectTrigger className="h-12 bg-white border-gray-200">
                                    <SelectValue placeholder="Select classification" />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-gray-200">
                                    <SelectItem value="Online Business">Online Only (SaaS/E-com)</SelectItem>
                                    <SelectItem value="Local Business">Local Business (Physical)</SelectItem>
                                    <SelectItem value="Hybrid">Hybrid (Physical + Online)</SelectItem>
                                    <SelectItem value="Enterprise">Enterprise / Corporate</SelectItem>
                                    <SelectItem value="Agency">Agency / Service Provider</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                );

            case 'competitors':
                return (
                    <div className="space-y-4 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-semibold text-gray-700">Competitors</Label>
                                <p className="text-xs text-gray-500 mt-1">Add competitors to compare AI visibility</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={handleAutoFindCompetitors}
                                disabled={autoFindingCompetitors || !formData.brandName || !formData.industry || (formData.industry === 'Custom' && !formData.customIndustry.trim())}
                                className="border-blue-200 text-blue-600 hover:bg-blue-50">
                                {autoFindingCompetitors ? (<><Loader2 className="h-3 w-3 animate-spin mr-1" />Finding...</>) : (<><Target className="h-3 w-3 mr-1" />Auto-Find</>)}
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {formData.competitors.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {formData.competitors.map((comp, idx) => (
                                        <div key={idx} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm flex items-center gap-2 border border-gray-200">
                                            <span className="text-gray-700">{comp} {formData.competitorUrls[comp] && <span className="text-xs text-blue-500 ml-1">({formData.competitorUrls[comp].replace(/^https?:\/\//, '').replace(/\/$/, '')})</span>}</span>
                                            <button onClick={() => handleRemoveCompetitor(idx)} className="text-gray-400 hover:text-red-500 transition-colors" type="button">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <Target className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">No competitors added yet.</p>
                                    <p className="text-xs">Click Auto-Find or add manually below.</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <Input placeholder="Enter competitor name" value={newCompetitor}
                                    onChange={(e) => setNewCompetitor(e.target.value)} onKeyDown={handleCompetitorKeyDown}
                                    className="flex-1 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20" maxLength={50} />
                                <Input placeholder="Website URL (optional)" value={newCompetitorUrl}
                                    onChange={(e) => setNewCompetitorUrl(e.target.value)}
                                    className="flex-1 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20" />
                                <Button onClick={handleAddCompetitor} disabled={!newCompetitor.trim() || newCompetitor.trim().length < 2}
                                    className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
                            </div>
                        </div>
                    </div>
                );

            case 'seed_keywords':
                return (
                    <div className="space-y-4 py-4">
                        {/* Quota Info Box */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <p className="text-sm font-semibold text-blue-900">Configure Auto-Prompts</p>
                                    <p className="text-xs text-blue-700">
                                        Each keyword generates automatically generated search prompts.
                                        Move the slider to decide how many AI questions to ask per topic.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Quota Limits */}
                        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">Your quota ({userRole}):</span>
                                <span className="text-sm font-semibold text-gray-900">
                                    {userLimits.maxKeywords} keywords × {promptsPerKeyword} = {promptsToGenerate} / {userLimits.maxPrompts} prompts
                                </span>
                            </div>
                            <span className={cn("text-sm font-medium px-2 py-0.5 rounded",
                                keywordsRemaining > 0 ? "text-emerald-700 bg-emerald-100" : "text-red-700 bg-red-100")}>
                                {keywordsRemaining} keywords remaining
                            </span>
                        </div>

                        {/* Prompts Per Keyword Slider */}
                        <div className="space-y-3 px-1">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold text-gray-700">Prompts to generate per keyword</Label>
                                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                    {promptsPerKeyword} prompts
                                </span>
                            </div>
                            <input
                                type="range"
                                min="3"
                                max="10"
                                step="1"
                                value={promptsPerKeyword}
                                onChange={(e) => setPromptsPerKeyword(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>3 (Min)</span>
                                <span>10 (Max)</span>
                            </div>
                        </div>

                        <div className="space-y-1 pt-2">
                            <Label className="text-sm font-semibold text-gray-700">Add Keyword Topics</Label>
                            <p className="text-sm text-gray-500">Enter topics/keywords you want to track in AI responses. Separate multiple keywords with commas or press Enter.</p>
                        </div>

                        <div className="flex gap-2">
                            <Input placeholder="e.g. organic dog food, best crm software" value={newKeyword}
                                onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={handleKeywordKeyDown}
                                disabled={keywordsRemaining <= 0}
                                className="flex-1 bg-white border-gray-200 focus:border-blue-500 focus:ring-blue-500/20" maxLength={100} />
                            <Button onClick={handleAddKeyword} disabled={!newKeyword.trim() || newKeyword.trim().length < 3 || keywordsRemaining <= 0}
                                className="bg-blue-600 hover:bg-blue-700 text-white">Add</Button>
                        </div>

                        <div className="space-y-3">
                            {formData.seedKeywords.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {formData.seedKeywords.map((kw, idx) => (
                                        <div key={idx} className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-full text-sm flex items-center gap-2">
                                            <span>{kw}</span>
                                            <span className="text-indigo-400 text-xs">×{promptsPerKeyword}</span>
                                            <button onClick={() => handleRemoveKeyword(idx)} className="text-indigo-400 hover:text-red-500 transition-colors" type="button">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                    <Lightbulb className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm">No keywords added yet.</p>
                                    <p className="text-xs">Add topics you want to track in AI responses.</p>
                                </div>
                            )}

                            {formData.seedKeywords.length > 0 && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                                    <p className="text-sm text-emerald-700">
                                        <strong>{promptsToGenerate} prompts</strong> will be generated
                                        ({formData.seedKeywords.length} keywords × {promptsPerKeyword} prompts each)
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'review_prompts':
                return (
                    <div className="space-y-4 py-4 h-[400px] flex flex-col">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold text-gray-700">
                                Review Prompts <span className={cn(generatedPrompts.length > userLimits.maxPrompts ? "text-red-600" : "text-gray-500")}>({generatedPrompts.length} / {userLimits.maxPrompts})</span>
                            </Label>
                            <span className="text-xs text-gray-500">Edit or delete prompts before continuing</span>
                        </div>

                        <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-2 bg-gray-50">
                            {generatedPrompts.map((prompt, idx) => (
                                <div key={idx} className="flex gap-2 items-start group">
                                    <Input
                                        value={prompt.text}
                                        onChange={(e) => handlePromptEdit(idx, e.target.value)}
                                        className="bg-white border-gray-200 text-sm h-9"
                                    />
                                    <button
                                        onClick={() => handlePromptDelete(idx)}
                                        className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                                        title="Remove prompt"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Input
                                placeholder="Add a custom prompt..."
                                value={newManualPrompt}
                                onChange={(e) => setNewManualPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddManualPrompt()}
                                className="flex-1 bg-white"
                            />
                            <Button onClick={handleAddManualPrompt} variant="outline" disabled={generatedPrompts.length >= userLimits.maxPrompts}>Add</Button>
                        </div>
                    </div>
                );

            case 'processing':
                return (
                    <div className="py-12 text-center space-y-6">
                        <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                            <div className="absolute inset-0 border-t-4 border-blue-500 border-solid rounded-full animate-spin"></div>
                            <span className="text-xs font-bold text-gray-700">{Math.round(processingProgress)}%</span>
                        </div>
                        <div className="space-y-4 max-w-md mx-auto px-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{processingStatus || "Setting up your Dashboard"}</h3>
                                <p className="text-gray-500 text-sm mt-1">
                                    Creating your brand profile and generating {promptsToGenerate} AI prompts from your keywords.
                                </p>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
                                <div
                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500 ease-out"
                                    style={{ width: `${processingProgress}%` }}
                                >
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-white border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                            <Globe className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold text-gray-900">
                                {currentStep === 'brand_details' && "Let's set up your brand"}
                                {currentStep === 'competitors' && "Who are you up against?"}
                                {currentStep === 'seed_keywords' && "What topics matter to you?"}
                                {currentStep === 'review_prompts' && "Review your AI prompts"}
                                {currentStep === 'processing' && "Working our magic..."}
                            </DialogTitle>
                            <DialogDescription className="text-gray-600">
                                Step {currentStep === 'brand_details' ? 1 : currentStep === 'competitors' ? 2 : currentStep === 'seed_keywords' ? 3 : currentStep === 'review_prompts' ? 4 : 4} of 4 • Setting up your AI visibility analytics
                            </DialogDescription>
                        </div>
                    </div>

                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${currentStep === 'brand_details' ? 25 : currentStep === 'competitors' ? 50 : currentStep === 'seed_keywords' ? 75 : 100}%` }} />
                    </div>
                </DialogHeader>

                {notification && (
                    <div className={cn("p-4 rounded-xl flex items-center gap-3 text-sm font-medium shadow-sm",
                        notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                        {notification.type === 'success' ? <CheckCircle2 className="h-5 w-5 flex-shrink-0" /> : <AlertCircle className="h-5 w-5 flex-shrink-0" />}
                        <span>{notification.message}</span>
                    </div>
                )}

                <div className="mt-4 text-gray-900 min-h-[300px]">
                    {renderStepContent()}
                </div>

                {currentStep !== 'processing' && (
                    <DialogFooter className="mt-6 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                                {currentStep !== 'brand_details' && (
                                    <Button variant="outline" onClick={handleBack} className="border-gray-200 text-gray-600 hover:bg-gray-50">Back</Button>
                                )}
                                <div className="text-sm text-gray-500">
                                    {currentStep === 'review_prompts' && `Reviewing ${generatedPrompts.length} prompts`}
                                    {currentStep === 'seed_keywords' && `${promptsToGenerate} prompts will be created`}
                                    {currentStep === 'competitors' && "You can skip this step if needed"}
                                    {currentStep === 'brand_details' && "All fields marked with * are required"}
                                </div>
                            </div>
                            <Button onClick={handleNext} disabled={loading}
                                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/25 px-8">
                                {currentStep === 'review_prompts' ? (
                                    loading ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Setting up...</>) : (<><Zap className="h-4 w-4 mr-2" />Start Audit</>)
                                ) : (<>Next Step<ChevronRight className="h-4 w-4 ml-2" /></>)}
                            </Button>
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
