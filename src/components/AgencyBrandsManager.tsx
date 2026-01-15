import { useState } from 'react';
import { Search, Plus, ExternalLink, Briefcase, MoreHorizontal, Settings } from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AgencyBrandsManagerProps {
    clients: any[];
    onSelectClient: (clientId: string) => void;
}

export function AgencyBrandsManager({ clients, onSelectClient }: AgencyBrandsManagerProps) {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredClients = clients.filter(c =>
        c.brand_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.industry?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6 fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Managed Brands</h2>
                    <p className="text-gray-500 mt-1">Access and manage your client portfolio.</p>
                </div>
                <Button className="bg-gray-900 text-white hover:bg-gray-800">
                    <Plus className="h-4 w-4 mr-2" />
                    Add New Brand
                </Button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search brands..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white border-gray-200"
                    />
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.map((client) => (
                    <div key={client.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />

                        <div className="p-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-700 border border-gray-200 shadow-sm">
                                        {client.brand_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{client.brand_name}</h3>
                                        <span className="text-xs text-gray-500 font-medium bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 mt-1 inline-block">
                                            {client.industry || "Uncategorized"}
                                        </span>
                                    </div>
                                </div>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => onSelectClient(client.id)}>
                                            <ExternalLink className="h-4 w-4 mr-2" /> Open Dashboard
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem>
                                            <Settings className="h-4 w-4 mr-2" /> Settings
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            <div className="space-y-3 pt-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Status</span>
                                    <span className="flex items-center gap-1.5 text-green-600 font-medium">
                                        <span className="h-2 w-2 rounded-full bg-green-500" /> Active
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-gray-500">Last Audit</span>
                                    <span className="text-gray-900 font-medium">Today</span>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-100">
                                <Button
                                    className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all font-medium"
                                    onClick={() => onSelectClient(client.id)}
                                >
                                    View Dashboard
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredClients.length === 0 && (
                    <div className="col-span-full py-12 text-center bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                        <Briefcase className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No brands found matching your search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
