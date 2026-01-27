# Forzeo GEO Visibility Dashboard - Complete SaaS UI Generation Prompt

## Context
Build a complete, production-ready SaaS application called "Forzeo GEO Dashboard". This platform allows brands to track their visibility across AI Search Engines (ChatGPT, Claude, Gemini, Perplexity).

**Key Requirement:** The design must be **LIGHT, PROFESSIONAL, and HIGHLY INTERACTIVE**. It should feel like a top-tier enterprise SaaS (e.g., Linear, Vercel, Stripe) but with a light, clean aesthetic.

---

# 1. TECH STACK & FOUNDATION

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** TailwindCSS (v3.4+)
- **Icons:** Lucide React
- **Animation:** Framer Motion (for smooth layout transitions and micro-interactions)
- **Components:** Radix UI Primitives (Headless UI for full custom styling)
- **Routing:** React Router v6
- **Data:** Supabase (Auth, Database)

---

# 2. DESIGN SYSTEM (Theme: Light & Professional)

## Color Palette
- **Backgrounds:**
    - Page: `#F8FAFC` (Slate 50)
    - Surface (Cards/Panels): `#FFFFFF` (White)
    - Sidebar/Header: `#FFFFFF` (White) with subtle border
- **Borders:** `#E2E8F0` (Slate 200) - Fine, crisp borders
- **Primary Action:** `#2563EB` (Blue 600) -> Hover `#1D4ED8` (Blue 700)
- **Text:**
    - Primary: `#0F172A` (Slate 900) - High contrast
    - Secondary: `#64748B` (Slate 500) - Soft but readable
    - Muted: `#94A3B8` (Slate 400)
- **Status Colors:**
    - Success: `#10B981` (Emerald 500)
    - Warning: `#F59E0B` (Amber 500)
    - Error: `#EF4444` (Red 500)
    - AI Models:
        - ChatGPT: `#10A37F` (Teal)
        - Claude: `#D97757` (Terracotta)
        - Gemini: `#1A73E8` (Google Blue)
        - Perplexity: `#3B82F6` (Indigo)

## Typography
- **Font:** Inter (Google Fonts) or system-ui
- **Weights:** 400 (Regular), 500 (Medium), 600 (SemiBold)
- **Style:** Clean, tight tracking (-0.01em), taller line-heights for readability

## Visual Language (Interactive & Polish)
- **Shadows:** Soft, diffused shadows for depth (`shadow-sm` for cards, `shadow-lg` for dropdowns/modals).
- **Rounding:** `rounded-lg` (8px) or `rounded-xl` (12px) for a modern feel.
- **Interactivity:**
    - Buttons transform slightly on hover (scale 1.02).
    - Table rows highlight on hover (`bg-slate-50`).
    - Modals crossfade and slide in.
    - Page transitions: Subtle fade-in/slide-up.
- **Micro-animations:**
    - Loading spinners are sleek.
    - Success checks animate in.
    - Toggle switches slide smoothly.

---

# 3. ONBOARDING WIZARD (Critical Flow)

**Concept:** When a new user signs up, they enter a multi-step wizard to set up their first brand. They cannot access the dashboard until this is complete.

## Step 1: Account Creation (Public Page)
- **Layout:** Split screen. Left side: value props/testimonials. Right side: Login form.
- **Visuals:** Clean white form on right.
- **Fields:** Email, Password, Name.
- **Action:** "Create Account" -> Redirects to Wizard if no brands exist.

## Step 2: Onboarding Wizard (Dedicated Route `/onboarding`)
*Use a stepper progress bar at the top.*

### Screen 2.1: Brand Basics
- **Title:** "Let's set up your brand"
- **Input:** Brand Name (e.g., "Slack")
- **Input:** Website URL (e.g., "slack.com")
- **Input:** Industry (Dropdown with icons)
- **Input:** Region (Dropdown: US, UK, Global, etc.)
- **Action:** [Next Step →]

### Screen 2.2: Define Competitors
- **Title:** "Who are you competing with?"
- **Description:** "We'll track your visibility against these rivals."
- **Interaction:**
    - Input field to type competitor name.
    - "Auto-Find" button (simulated or API call) to suggest competitors.
    - Tags appear below as chips with 'X' to remove.
- **Action:** [Next Step →]

### Screen 2.3: Seed Keywords
- **Title:** "What do customers search for?"
- **Interaction:**
    - **Smart Input:** Input field must detect commas (`,`) and `Enter` key presses to tokenize inputs.
        - *Logic:* If user types "keyword1, keyword2", it should immediately split into two separate chips: [keyword1] [keyword2].
        - *Paste Handling:* Pasting a comma-separated list should automatically generate multiple chips.
    - **Helper Text:** "Type keywords separated by commas or press Enter."
    - Feature: "Generate Suggestions" button using AI to fill chips.
- **Action:** [Complete Setup & Start Audit]

### Screen 2.4: Success & Transition
- **Visual:** Celebration animation (confetti or checkmark).
- **Text:** "Setting up your dashboard..."
- **Transition:** Automatically redirects to the Main Dashboard after 2 seconds.

---

# 4. MAIN DASHBOARD LAYOUT

## Sidebar (Left, Fixed)
- **Background:** White, Border-Right (Slate 200).
- **Header:** Forzeo Logo + Brand Switcher Dropdown.
- **Navigation:**
    - **Overview** (Home icon)
    - **Prompts** (MessageSquare icon)
    - **Intelligence** (Sparkles icon - *Yellow/Gold accent*)
    - **Signals** (RSS/Radio icon)
    - **Campaigns** (Layers icon)
    - **Sources** (Globe icon)
    - **Content** (PenTool icon)
- **Footer:** User Profile (Avatar + Name), Settings, Log Out.
- **Active State:** Light blue background (`bg-blue-50`) + Blue text (`text-blue-600`) + Blue vertical bar indicator.

## Header (Top, Sticky)
- **Breadcrumbs:** e.g., "Dashboard / Overview"
- **Actions:**
    - [Global Date Range Picker]
    - [Notification Bell]
    - [Help/Support]
- **Style:** White, Border-Bottom, `h-16`, flex layout.

---

# 5. CORE PAGES (Interactive & Detailed)

## A. Overview Page (The "Command Center")
- **Top Row (KPI Cards):**
    - **Share of Voice:** Circular progress chart + Trend indicator.
    - **Avg Rank:** Large number + "vs Competitors" sparkline.
    - **Total Citations:** Counter with +% change.
- **Middle Section:**
    - **Visibility Chart (Main):** Large Area Chart or Bar Chart showing SOV over time.
    - **Recommendation Feed:** "To-Do" list styling. Each item has an "Action" button.
        - *Example:* "Fix citation on Forbes" -> [View Details]

## B. Prompts Page (Data Grid)
- **Toolbar:** Search, [Add Prompt], [Bulk Import], [Generate AI Prompts].
- **Table:**
    - **Columns:** Prompt Text, Category (Badge), SOV (Color Bar), Rank, Last Run.
    - **Interactions:**
        - Row Click -> Opens **Side Sheet (Slide Over)** with full details.
        - Hover Actions: Run Now, Edit, Archive.
- **Detail Panel (Side Sheet):**
    - Show full conversation for each Model (Tabs: ChatGPT | Claude | Gemini).
    - Syntax highlighting for AI responses.
    - "Generate Content" button to fix issues.

## C. Citation Intelligence (Deep Dive)
- **Layout:** Filter sidebar (left) + Data Table (right).
- **Features:**
    - **Filters:** Categories (UGC, Press, etc.), Status (Verified/Hallucinated).
    - **Table:** Lists URLs.
        - *Column: Opportunity* -> Badges (High/Med/Low).
        - *Column: Status* -> Checkmark (Verified) or Alert (Hallucinated).
- **Interactive Element (Deep Analysis):**
    - Toggle button: "Deep Analysis Mode (Tavily/Groq)" -> Triggers loading state/toast notification.

## D. Campaigns (Batch Operations)
- **View:** Grid of Cards.
- **Card Design:**
    - Title: Campaign Name
    - Progress Bar: "45/50 Prompts Processed"
    - Status Badge: "Running" (Pulse animation) or "Completed".
    - Footer Actions: [View Report] [Export]

## E. Signals (Future Trends)
- **Design:** Feed style (like a news reader).
- **Items:** Cards with "Influence Score" (Gauge or Bar).
- **Labels:** "Pre-Trend", "Rising", "Stable".

---

# 6. MOCK DATA & STATES

- **Loading:** Use Skeleton loaders (shimmer effect) that match the shape of the content.
- **Empty:** Beautiful SVG illustrations for empty states with clear Call-to-Action buttons.
- **Error:** Toast notifications (red) and inline error messages on forms.

---

# 7. SPECIFIC INSTRUCTIONS FOR GENERATION

1.  **Code Structure:**
    - `/src/components/ui`: Put all generic UI components (Buttons, Inputs, Cards) here.
    - `/src/pages`: One file per major page.
    - `/src/layouts`: DashboardLayout, AuthLayout.
    - `/src/hooks`: `useAuth`, `useDashboardData`.
2.  **Responsiveness:**
    - Mobile: Sidebar collapses to Bottom Navigation or Hamburger Menu.
    - Tables: Horizontal scroll with sticky first column on small screens.
3.  **Polish:**
    - Add `className="transition-all duration-200"` to interactive elements.
    - Use `backdrop-blur` for sticky headers/modals.
    - Ensure text consistency (H1 vs H2 vs Body).

---

**Generate the full codebase based on this prompt.**
