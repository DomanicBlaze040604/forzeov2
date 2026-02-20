import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Save, FolderOpen, X } from 'lucide-react';
import { toast } from 'sonner';

interface Client {
  id: string;
  brand_name: string;
  industry?: string;
  target_region?: string;
  logo_url?: string;
}

interface AccountGroup {
  id: string;
  name: string;
  description?: string;
  client_ids: string[];
  created_at: string;
}

interface AccountSelectorProps {
  clients: Client[];
  selectedClientIds: string[];
  onSelectionChange: (clientIds: string[]) => void;
  promptCounts?: Record<string, number>; // Optional: Number of active prompts per client
}

export default function AccountSelector({
  clients,
  selectedClientIds,
  onSelectionChange,
  promptCounts = {},
}: AccountSelectorProps) {
  const [search, setSearch] = useState('');
  const [accountGroups, setAccountGroups] = useState<AccountGroup[]>([]);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  // Fetch saved account groups on mount
  useEffect(() => {
    fetchAccountGroups();
  }, []);

  const fetchAccountGroups = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('account_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAccountGroups(data || []);
    } catch (error) {
      console.error('Failed to fetch account groups:', error);
      toast.error('Failed to load account groups');
    }
  };

  const saveAccountGroup = async () => {
    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    if (selectedClientIds.length === 0) {
      toast.error('Please select at least one brand');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('account_groups')
        .insert({
          user_id: user.id,
          name: groupName,
          description: groupDescription || null,
          client_ids: selectedClientIds,
        });

      if (error) throw error;

      toast.success(`Saved group: ${groupName}`);
      setIsSaveDialogOpen(false);
      setGroupName('');
      setGroupDescription('');
      fetchAccountGroups();
    } catch (error) {
      console.error('Failed to save account group:', error);
      toast.error('Failed to save account group');
    }
  };

  const loadAccountGroup = (group: AccountGroup) => {
    onSelectionChange(group.client_ids);
    toast.success(`Loaded group: ${group.name} (${group.client_ids.length} brands)`);
  };

  const deleteAccountGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Delete account group "${groupName}"?`)) return;

    try {
      const { error } = await supabase
        .from('account_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success(`Deleted group: ${groupName}`);
      fetchAccountGroups();
    } catch (error) {
      console.error('Failed to delete account group:', error);
      toast.error('Failed to delete account group');
    }
  };

  const toggleClient = (clientId: string) => {
    const newSelection = selectedClientIds.includes(clientId)
      ? selectedClientIds.filter(id => id !== clientId)
      : [...selectedClientIds, clientId];
    onSelectionChange(newSelection);
  };

  const selectAll = () => {
    onSelectionChange(filteredClients.map(c => c.id));
    toast.success(`Selected all ${filteredClients.length} brands`);
  };

  const clearAll = () => {
    onSelectionChange([]);
    toast.success('Cleared all selections');
  };

  // Filter clients by search query
  const filteredClients = clients.filter(client =>
    client.brand_name.toLowerCase().includes(search.toLowerCase()) ||
    client.industry?.toLowerCase().includes(search.toLowerCase()) ||
    client.target_region?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header: Search + Load Group + Save Group */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search brands by name, industry, or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Load Group */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <FolderOpen className="h-4 w-4 mr-2" />
              Load Group
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {accountGroups.length === 0 ? (
              <div className="p-2 text-sm text-gray-500">No saved groups</div>
            ) : (
              accountGroups.map(group => (
                <div
                  key={group.id}
                  className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => loadAccountGroup(group)}>
                    <div className="font-medium text-sm">{group.name}</div>
                    <div className="text-xs text-gray-500">
                      {group.client_ids.length} brands
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAccountGroup(group.id, group.name);
                    }}
                  >
                    <X className="h-3 w-3 text-gray-400 hover:text-red-600" />
                  </Button>
                </div>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Save Group */}
        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={selectedClientIds.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Save Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Account Group</DialogTitle>
              <DialogDescription>
                Save your current selection of {selectedClientIds.length} brands for quick reuse
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="group-name">Group Name *</Label>
                <Input
                  id="group-name"
                  placeholder="e.g., Top 10 Priority Brands"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="group-description">Description (Optional)</Label>
                <Textarea
                  id="group-description"
                  placeholder="e.g., Main brands to audit daily"
                  value={groupDescription}
                  onChange={e => setGroupDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={saveAccountGroup}>Save Group</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selection Summary + Actions */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-medium">
            {selectedClientIds.length} / {filteredClients.length} selected
          </Badge>
          {search && (
            <span className="text-sm text-gray-500">
              (filtered from {clients.length} total)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
            disabled={filteredClients.length === 0}
          >
            Select All
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={selectedClientIds.length === 0}
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Client List */}
      <ScrollArea className="h-[400px] border rounded-lg">
        <div className="p-4 space-y-2">
          {filteredClients.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {search ? 'No brands match your search' : 'No brands available'}
            </div>
          ) : (
            filteredClients.map(client => (
              <div
                key={client.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => toggleClient(client.id)}
              >
                <Checkbox
                  checked={selectedClientIds.includes(client.id)}
                  onCheckedChange={() => toggleClient(client.id)}
                  onClick={e => e.stopPropagation()}
                />
                {client.logo_url && (
                  <img
                    src={client.logo_url}
                    alt={client.brand_name}
                    className="h-8 w-8 rounded object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1">
                  <div className="font-medium">{client.brand_name}</div>
                  <div className="text-xs text-gray-500">
                    {client.industry && <span>{client.industry}</span>}
                    {client.industry && client.target_region && <span> • </span>}
                    {client.target_region && <span>{client.target_region}</span>}
                  </div>
                </div>
                {promptCounts[client.id] !== undefined && (
                  <Badge variant="outline" className="ml-auto">
                    {promptCounts[client.id]} prompts
                  </Badge>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer Summary */}
      {selectedClientIds.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm text-blue-900">
            <strong>{selectedClientIds.length} brands</strong> selected •{' '}
            <strong>
              {selectedClientIds.reduce((sum, id) => sum + (promptCounts[id] || 0), 0)}
            </strong>{' '}
            total prompts
          </div>
        </div>
      )}
    </div>
  );
}
