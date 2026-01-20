# Forzeo GEO Visibility Dashboard - Complete UI/UX Generation Prompt

## Use this prompt with Google Stitch or any AI UI generation tool

---

# MASTER PROMPT

Build a complete **AI Visibility Analytics Dashboard** called "Forzeo GEO Dashboard" - a SaaS platform that tracks how brands appear in AI-generated responses (ChatGPT, Claude, Gemini, Perplexity).

## Tech Stack
- React 18 + TypeScript + Vite
- TailwindCSS with dark theme
- Radix UI primitives (Dialog, Select, Dropdown, Tabs, Toast)
- Lucide React icons
- Supabase for auth/database

---

# DESIGN SYSTEM

## Colors
```
Primary: #3b82f6 (Blue)
Background: #0f172a (Slate 900)
Surface: #1e293b (Slate 800)
Border: #334155 (Slate 700)
Text Primary: #f8fafc (Slate 50)
Text Secondary: #94a3b8 (Slate 400)
Success: #22c55e (Green)
Warning: #eab308 (Yellow)
Error: #ef4444 (Red)

Model Colors:
- ChatGPT: #10a37f
- Claude: #d97757
- Gemini: #4285f4
- Perplexity: #6366f1
```

## Typography
- Font: Inter
- Headings: font-semibold
- Body: font-normal

## Aesthetic
- Dark glassmorphism theme
- Subtle gradients
- Rounded corners (rounded-xl)
- Card shadows with glow effects
- Smooth hover transitions

---

# SCREENS TO GENERATE

## 1. LOGIN PAGE
- Centered card with logo
- Email + Password fields
- "Sign In" button (blue gradient)
- "Don't have an account? Sign up" link
- Dark background with subtle pattern

## 2. MAIN DASHBOARD LAYOUT
```
┌─────────────────────────────────────────────────────────┐
│ SIDEBAR (240px)          MAIN CONTENT (flex-1)          │
│ ┌────────────────┐     ┌──────────────────────────────┐│
│ │ Logo: "Forzeo" │     │ Header: Brand name + filters ││
│ │                │     │ [Date] [Model] [Export]      ││
│ │ Brand Selector │     ├──────────────────────────────┤│
│ │ ▼ Select Brand │     │                              ││
│ │                │     │     TAB CONTENT AREA         ││
│ │ Navigation:    │     │                              ││
│ │ • Overview     │     │                              ││
│ │ • Prompts      │     │                              ││
│ │ • Intelligence │     │                              ││
│ │ • Signals      │     │                              ││
│ │ • Citations    │     │                              ││
│ │ • Campaigns    │     │                              ││
│ │ • Sources      │     │                              ││
│ │ • Content      │     │                              ││
│ │                │     └──────────────────────────────┘│
│ │ [+ Add Brand]  │                                      │
│ │                │                                      │
│ │ ─────────────  │                                      │
│ │ User Profile   │                                      │
│ │ email@...      │                                      │
│ │ [Admin] badge  │                                      │
│ │ [Sign Out]     │                                      │
│ └────────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

## 3. OVERVIEW TAB
**4 Metric Cards (Top Row):**
- Share of Voice: Large % with trend arrow
- Average Rank: Number with position indicator
- Total Citations: Count with growth %
- Total Cost: $ amount

**Visibility by Model Chart (Bar Chart):**
- Horizontal bars for each AI model
- Color-coded by model brand colors
- Show % visibility per model

**Competitor Gap Panel:**
- Horizontal bar chart comparing brand vs competitors
- Shows mention % for each entity

**AI Insights Panel (Right Side):**
- Card with "AI Insights" header
- Priority badge (High/Medium/Low)
- 5 bullet point recommendations
- "Refresh Insights" button

## 4. PROMPTS TAB
**Header:**
- "Prompts" title with count badge
- [+ Add Prompt] button
- [Bulk Import] button
- [Generate with AI] button
- Search input

**Prompts Table:**
| Prompt Text | Category | SOV | Rank | Citations | Status | Actions |
|-------------|----------|-----|------|-----------|--------|---------|

- Category: Badge (broad/niche/comparison/etc)
- SOV: % with color (green >60%, yellow 30-60%, red <30%)
- Status: "Run" button or "Running..." spinner
- Actions: [Run] [Edit] [Delete] icons

**Click Row → Prompt Detail Modal:**
- Full prompt text
- Model results (ChatGPT, Claude, Gemini, Perplexity tabs)
- Raw AI response text
- Citations extracted
- Competitors mentioned
- "Generate Content" button
- "Export Report" button

## 5. INTELLIGENCE TAB (Citation Intelligence)
**Header:**
- "Citation Intelligence" title
- [Analyze New] button
- Filter dropdowns: Category, Status, Opportunity

**Citation Table:**
| Status | URL/Domain | Category | Opportunity | Model | Actions |
|--------|------------|----------|-------------|-------|---------|

- Status: ✓ Verified / ⚠ Hallucinated badge
- Category: UGC, Press, Wikipedia, Competitor, Brand Owned
- Opportunity: Easy (green), Medium (yellow), Difficult (red)

**Click Row → Citation Detail Panel:**
- Full URL with external link
- Verification status
- AI Analysis summary
- Brand/Competitor mentions
- Recommended Actions (3-5 items)
- Generated Content (expandable)
- "Regenerate" button

## 6. CAMPAIGNS TAB
**Header:**
- "Campaigns" title
- [+ Create Campaign] button

**Campaign Cards Grid:**
```
┌────────────────────────┐
│ Campaign Name          │
│ Status: Running/Done   │
│ ──────────────────     │
│ Prompts: 45/50         │
│ Avg SOV: 65%           │
│ Citations: 234         │
│ ──────────────────     │
│ [View] [Edit] [Delete] │
└────────────────────────┘
```

**Campaign Detail View:**
- Summary metrics (SOV, Rank, Citations, Cost)
- All prompts table with individual results
- Aggregated competitor leaderboard
- All citations combined
- Export button

## 7. SIGNALS TAB (Fresh Content Detection)
**Header:**
- "Fresh Signals" title
- [+ Add RSS Feed] button
- Filter: Classification (Emerging/Reinforcing/Low Impact)

**Signals Table:**
| Title | Source | Influence Score | Published | Classification |
|-------|--------|-----------------|-----------|----------------|

- Influence Score: Progress bar 0-100%
- Classification badge with color

**Add Feed Modal:**
- Feed name
- RSS URL
- Brand keywords (tags input)
- Competitor keywords (tags input)
- Poll interval dropdown

## 8. SOURCES TAB
**Aggregated Citation Sources:**
- Top cited domains list
- Source category breakdown (pie chart)
- Click domain → See all prompts citing it

## 9. CONTENT TAB
**AI Content Generator:**
- Prompt selector dropdown
- "Generate Visibility Content" button
- Generated content preview (Markdown rendered)
- Copy to clipboard button
- Regenerate button

---

# DIALOGS/MODALS

## Add Brand Dialog
```
┌─────────────────────────────────────┐
│ Add New Brand                    [X]│
├─────────────────────────────────────┤
│ Brand Name: [________________]      │
│ Website:    [________________]      │
│ Industry:   [▼ Select Industry]     │
│ Region:     [▼ United States]       │
│                                     │
│ Competitors:                        │
│ [Tag1] [Tag2] [+ Add]  [Auto-Find] │
│                                     │
│ Brand Tags (optional):              │
│ [Tag] [Tag] [+ Add]                │
│                                     │
│        [Cancel]  [Add Brand]        │
└─────────────────────────────────────┘
```

## Bulk Prompts Dialog
```
┌─────────────────────────────────────┐
│ Add Multiple Prompts             [X]│
├─────────────────────────────────────┤
│ Enter prompts (one per line):       │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ─── OR Generate with AI ───         │
│                                     │
│ Keywords: [________________]        │
│ Sentiment: [▼ Neutral]              │
│ Focus: [▼ General]                  │
│ [Generate 10 Prompts]               │
│                                     │
│        [Cancel]  [Add Prompts]      │
└─────────────────────────────────────┘
```

## Create Campaign Dialog
- Campaign name input
- Prompt multi-select with checkboxes
- Create button

## User Management Dialog (Admin only)
- Users table with email, role, status
- Toggle access button per user
- Role dropdown (Admin/Agency/User)

---

# AGENCY VIEW (Role: Agency)

**AgencyOverview Component (replaces Overview for agency users):**
- Total Brands managed (count)
- Total Prompts across brands
- Average Visibility (global SOV)
- "Brands Needing Attention" alert cards (SOV < 30%)
- Quick brand switcher grid

**Quotas Display in Sidebar:**
- "3/5 Brands" badge
- "12/15 Prompts" badge per brand
- Visual warning at 80% capacity

---

# RESPONSIVE DESIGN

**Mobile (< 768px):**
- Sidebar becomes hamburger menu
- Tables become card stacks
- Filters become drawer

**Tablet (768-1024px):**
- Collapsed sidebar (icons only)
- 2-column grid for cards

**Desktop (> 1024px):**
- Full sidebar
- 3-4 column grids

---

# LOADING STATES

- Skeleton loaders for all cards
- "Querying ChatGPT..." progress text
- Spinning icon on Run buttons
- Progress bar for campaigns

# EMPTY STATES

- No prompts: "Add your first prompt to get started"
- No campaigns: "Create a campaign to batch-audit prompts"
- No citations: "Run an audit to discover citations"

# TOAST NOTIFICATIONS

- Success: "Prompt added successfully" (green)
- Error: "Failed to run audit" (red)
- Info: "Generating content..." (blue)

---

# ICONS USED (Lucide)

- Home, MessageSquare, Lightbulb, Zap, Link2
- Layers, Globe, Sparkles, Settings, LogOut
- Plus, Trash2, Edit, RefreshCw, Download
- ChevronDown, ExternalLink, Check, X, AlertTriangle

---

Generate ALL screens as a complete, production-ready React application with:
1. Full routing (React Router)
2. State management (React hooks + context)
3. Supabase integration ready
4. All components styled with TailwindCSS
5. Dark theme throughout
6. Responsive design
7. Accessibility (ARIA labels)
