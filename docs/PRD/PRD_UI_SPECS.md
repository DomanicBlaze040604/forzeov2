# UI Specifications - Complete

Component library, design tokens, and layout specifications.

---

## Design System

### Colors
```css
/* Primary Palette */
--blue-50: #eff6ff;
--blue-500: #3b82f6;
--blue-600: #2563eb;
--blue-700: #1d4ed8;

/* Status Colors */
--green-500: #22c55e;  /* Success */
--yellow-500: #eab308; /* Warning */
--red-500: #ef4444;    /* Error/Critical */
--gray-500: #6b7280;   /* Neutral */

/* Model Colors */
--chatgpt: #10a37f;    /* Green */
--claude: #d97757;     /* Orange */
--gemini: #4285f4;     /* Blue */
--perplexity: #6366f1; /* Indigo */
```

### Typography
```css
/* Font Family */
font-family: 'Inter', -apple-system, sans-serif;

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing
```css
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-5: 1.25rem;  /* 20px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
```

---

## C1. ClientDashboard Component

**File:** `src/pages/ClientDashboard.tsx`  
**Lines:** 3,028

### Layout Structure
```
┌─────────────────────────────────────────────────────────┐
│  Sidebar (240px)         Main Content (flex-1)          │
│  ┌────────────────┐     ┌──────────────────────────┐   │
│  │ Logo           │     │ Header Bar               │   │
│  │ Client Selector│     │ - Title                  │   │
│  │ Navigation     │     │ - Date Filter            │   │
│  │ - Overview     │     │ - Model Filter           │   │
│  │ - Prompts      │     │ - Export Button          │   │
│  │ - Intelligence │     └──────────────────────────┘   │
│  │ - Signals      │     ┌──────────────────────────┐   │
│  │ - Citations    │     │                          │   │
│  │ - Campaigns    │     │  Tab Content (Dynamic)   │   │
│  │ - Sources      │     │                          │   │
│  │ - Content      │     │                          │   │
│  │                │     │                          │   │
│  │ [Settings]     │     │                          │   │
│  │ [Sign Out]     │     └──────────────────────────┘   │
│  └────────────────┘                                     │
└─────────────────────────────────────────────────────────┘
```

### Sidebar
**Component:** Fixed left sidebar with collapsible functionality

**Nav Items:**
```tsx
<nav className="flex-1 px-3 space-y-1">
  <NavItem icon={<Home />} label="Overview" active={tab === 'overview'} />
  <NavItem icon={<MessageSquare />} label="Prompts" active={tab === 'prompts'} />
  <NavItem icon={<Lightbulb />} label="Intelligence" active={tab === 'intelligence'} />
  <NavItem icon={<Zap />} label="Signals" active={tab === 'signals'} />
  <NavItem icon={<Link2 />} label="Citations" active={tab === 'citations'} />
  <NavItem icon={<Layers />} label="Campaigns" active={tab === 'campaigns'} />
  <NavItem icon={<Globe />} label="Sources" active={tab === 'sources'} />
  <NavItem icon={<Sparkles />} label="Content" active={tab === 'content'} />
</nav>
```

**User Profile Section (Sidebar Footer):**
```tsx
<div className="p-4 border-t border-gray-200">
  <div className="flex items-center gap-2">
    <Avatar className="h-8 w-8">
      <AvatarFallback>{userEmail.substring(0,2).toUpperCase()}</AvatarFallback>
    </Avatar>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{userEmail}</p>
      {isAdmin && <Badge variant="default">Admin</Badge>}
      {isAgency && <Badge variant="secondary">Agency</Badge>}
    </div>
  </div>
  <Button variant="ghost" onClick={handleSignOut} className="mt-2 w-full">
    <LogOut className="h-4 w-4 mr-2" /> Sign Out
  </Button>
</div>
```

---

## C2. AgencyOverview Component

**File:** `src/components/Agency Overview.tsx`  
**Lines:** 141

### Layout
```tsx
<div className="space-y-8">
  {/* Header */}
  <div className="flex items-center justify-between">
    <div>
      <h2 className="text-2xl font-bold">Agency Dashboard</h2>
      <p className="text-gray-500">Overview of all managed brands</p>
    </div>
    <Badge className="bg-blue-50 text-blue-700">
      <Shield className="h-4 w-4" /> Agency Admin
    </Badge>
  </div>

  {/* Metrics Grid */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {/* Total Brands Card */}
    {/* Total Prompts Card */}
    {/* Average Visibility Card */}
  </div>

  {/* Alerts & Quick Access */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Brands Needing Attention */}
    {/* Top Performing Brands */}
  </div>
</div>
```

### Metric Cards
```tsx
<div className="bg-white p-6 rounded-xl border shadow-sm">
  <div className="flex items-center justify-between mb-4">
    <h3 className="text-sm font-medium text-gray-500 uppercase">Total Brands</h3>
    <div className="p-2 bg-indigo-50 rounded-lg">
      <Users className="h-5 w-5 text-indigo-600" />
    </div>
  </div>
  <div className="text-3xl font-bold text-gray-900">{totalClients}</div>
  <div className="mt-2 text-sm text-gray-500">Active managed clients</div>
</div>
```

---

## C3. Citation Intelligence Component

**File:** `src/components/CitationIntelligence.tsx`

### Table with Advanced Features

**Filtering System:**
```tsx
<div className="flex items-center gap-2 mb-4">
  {/* Category Filter */}
  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="All Categories" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Categories</SelectItem>
      <SelectItem value="ugc">UGC / Social</SelectItem>
      <SelectItem value="press_media">Press & Media</SelectItem>
      <SelectItem value="competitor_blog">Competitor</SelectItem>
      <SelectItem value="app_store">App Store</SelectItem>
      <SelectItem value="wikipedia">Wikipedia</SelectItem>
    </SelectContent>
  </Select>

  {/* Status Filter */}
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectItem value="all">All Status</SelectItem>
    <SelectItem value="verified">Verified</SelectItem>
    <SelectItem value="hallucinated">Hallucinated</SelectItem>
  </Select>

  {/* Search */}
  <Input
    placeholder="Search URL, domain, title..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="max-w-xs"
  />
  
  {/* Clear All */}
  {hasActiveFilters && (
    <Button variant="ghost" onClick={clearFilters}>Clear All</Button>
  )}
</div>
```

**Sortable Table:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead className="w-12">
        <Checkbox
          checked={selectAll}
          onCheckedChange={handleSelectAll}
        />
      </TableHead>
      <TableHead onClick={() => handleSort('status')} className="cursor-pointer">
        Status {sortColumn === 'status' && <SortIcon />}
      </TableHead>
      <TableHead onClick={() => handleSort('domain')}>
        URL / Domain {sortColumn === 'domain' && <SortIcon />}
      </TableHead>
      <TableHead onClick={() => handleSort('category')}>
        Category {sortColumn === 'category' && <SortIcon />}
      </TableHead>
      <TableHead onClick={() => handleSort('opportunity')}>
        Opportunity {sortColumn === 'opportunity' && <SortIcon />}
      </TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {paginatedData.map(citation => (
      <TableRow key={citation.id} className="hover:bg-gray-50">
        <TableCell>
          <Checkbox
            checked={selectedCitations.includes(citation.id)}
            onCheckedChange={() => toggleSelect(citation.id)}
          />
        </TableCell>
        <TableCell>
          <StatusBadge status={citation.is_hallucinated ? 'hallucinated' : 'verified'} />
        </TableCell>
        <TableCell>
          <a href={citation.url} className="text-blue-600 hover:underline">
            {citation.domain}
          </a>
        </TableCell>
        <TableCell>
          <CategoryBadge category={citation.citation_category} />
        </TableCell>
        <TableCell>
          <OpportunityBadge level={citation.opportunity_level} />
        </TableCell>
        <TableCell>
          <Button size="sm" onClick={() => viewDetails(citation)}>View</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**Pagination:**
```tsx
<div className="flex items-center justify-between mt-4">
  <div className="text-sm text-gray-500">
    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
  </div>
  
  <div className="flex items-center gap-2">
    <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
      <SelectTrigger className="w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="10">10 / page</SelectItem>
        <SelectItem value="25">25 / page</SelectItem>
        <SelectItem value="50">50 / page</SelectItem>
        <SelectItem value="100">100 / page</SelectItem>
      </SelectContent>
    </Select>
    
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage(p => p - 1)}
        disabled={currentPage === 1}
      >
        Previous
      </Button>
      {pageNumbers.map(num => (
        <Button
          key={num}
          variant={num === currentPage ? 'default' : 'outline'}
          size="sm"
          onClick={() => setCurrentPage(num)}
        >
          {num}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCurrentPage(p => p + 1)}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  </div>
</div>
```

---

## C4. Radix UI Component Usage

**Dialog:**
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Create Campaign</DialogTitle>
      <DialogDescription>
        Select prompts to include in this campaign
      </DialogDescription>
    </DialogHeader>
    {/* Content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button onClick={handleSubmit}>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Badge Variants:**
```tsx
{/* Status Badges */}
<Badge className="bg-green-100 text-green-700">Verified</Badge>
<Badge className="bg-red-100 text-red-700">Hallucinated</Badge>
<Badge className="bg-gray-100 text-gray-700">Unknown</Badge>

{/* Opportunity Badges */}
<Badge className="bg-green-50 text-green-600">Easy Win</Badge>
<Badge className="bg-yellow-50 text-yellow-600">Medium Effort</Badge>
<Badge className="bg-red-50 text-red-600">Difficult</Badge>

{/* Role Badges */}
<Badge variant="default">Admin</Badge>
<Badge variant="secondary">Agency</Badge>
<Badge variant="outline">User</Badge>
```

**Toast Notifications:**
```tsx
import { useToast } from '@/components/ui/use-toast';

const { toast } = useToast();

toast({
  title: "Success",
  description: "Campaign created successfully",
  variant: "default"
});

toast({
  title: "Error",
  description: "Failed to delete citation",
  variant: "destructive"
});
```

---

## Responsive Breakpoints

```css
/* Mobile */
@media (max-width: 640px) {
  .sidebar { display: none; }
  .mobile-menu { display: block; }
}

/* Tablet */
@media (min-width: 641px) and (max-width: 1024px) {
  .sidebar { width: 200px; }
  .grid-cols-3 { grid-template-columns: repeat(2, 1fr); }
}

/* Desktop */
@media (min-width: 1025px) {
  .sidebar { width: 240px; }
  .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
}
```

---

**Component Count:** 50+ reusable components  
**Radix UI Primitives:** Dialog, Select, Checkbox, Badge, Toast, Avatar, Dropdown
