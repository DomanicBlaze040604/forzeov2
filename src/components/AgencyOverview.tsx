import { Users, MessageSquare, Eye, TrendingUp, Activity, ArrowRight, Shield } from 'lucide-react';


interface AgencyOverviewProps {
    clients: any[];
    prompts: any[];
    auditResults: any[];
    onNavigateToBrand: (clientId: string) => void;
}

export function AgencyOverview({ clients, prompts, auditResults, onNavigateToBrand }: AgencyOverviewProps) {
    // Calculate aggregated metrics
    const totalClients = clients.length;
    const totalPrompts = prompts.length;

    // Calculate average visibility across all brands (using latest audit for each prompt)
    const recentAudits = auditResults.slice(0, 100); // Take recent sample
    const avgVisibility = recentAudits.length > 0
        ? Math.round(recentAudits.reduce((sum, r) => sum + (r.summary?.share_of_voice || 0), 0) / recentAudits.length)
        : 0;

    // Identify brands needing attention (low visibility)
    const brandsWithLowVisibility = clients.map(client => {
        const clientAudits = auditResults.filter(r => r.client_id === client.id);
        if (!clientAudits.length) return null;
        const clientAvgVis = clientAudits.reduce((sum, r) => sum + (r.summary?.share_of_voice || 0), 0) / clientAudits.length;
        return clientAvgVis < 30 ? { ...client, visibility: Math.round(clientAvgVis) } : null;
    }).filter(Boolean);

    return (
        <div className="space-y-8 fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Agency Dashboard</h2>
                    <p className="text-gray-500 mt-1">Overview of all managed brands and performance.</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm font-medium border border-blue-100">
                    <Shield className="h-4 w-4" />
                    Agency Admin
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Brands</h3>
                        <div className="p-2 bg-indigo-50 rounded-lg"><Users className="h-5 w-5 text-indigo-600" /></div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{totalClients}</div>
                    <div className="mt-2 text-sm text-gray-500">Active managed clients</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Prompts</h3>
                        <div className="p-2 bg-blue-50 rounded-lg"><MessageSquare className="h-5 w-5 text-blue-600" /></div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{totalPrompts}</div>
                    <div className="mt-2 text-sm text-gray-500">Across all brands</div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Avg Visibility</h3>
                        <div className="p-2 bg-green-50 rounded-lg"><Eye className="h-5 w-5 text-green-600" /></div>
                    </div>
                    <div className="text-3xl font-bold text-gray-900">{avgVisibility}%</div>
                    <div className="mt-2 text-sm text-gray-500">Global Share of Voice</div>
                </div>
            </div>

            {/* Critical Alerts & Quick Access */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Brands Needing Attention */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-orange-500" />
                            Brands Needing Attention
                        </h3>
                        <span className="text-xs font-medium bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{brandsWithLowVisibility.length} Alerts</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {brandsWithLowVisibility.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Shield className="h-8 w-8 mx-auto mb-2 text-green-300" />
                                <p>All brands perform well (&gt;30% visibility)</p>
                            </div>
                        ) : (
                            brandsWithLowVisibility.slice(0, 5).map((client: any) => (
                                <div key={client.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onNavigateToBrand(client.id)}>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{client.brand_name}</h4>
                                        <p className="text-xs text-red-500 mt-0.5">Low Visibility: {client.visibility}%</p>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-gray-300" />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Quick Brand Switcher List (Top 5) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            Top Performing Brands
                        </h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {clients.slice(0, 5).map((client) => (
                            <div key={client.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => onNavigateToBrand(client.id)}>
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 border border-gray-200">
                                        {client.brand_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{client.brand_name}</h4>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-gray-300" />
                            </div>
                        ))}
                        {clients.length === 0 && <div className="p-8 text-center text-gray-500">No brands assigned.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
}
