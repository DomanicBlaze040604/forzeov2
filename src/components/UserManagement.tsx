import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Shield, User as UserIcon, CheckCircle, XCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface User {
    id: string;
    email: string;
    role: 'admin' | 'user';
    is_active: boolean;
    created_at: string;
    last_login_at: string | null;
}

interface Client {
    id: string;
    brand_name: string;
}

interface UserClient {
    user_id: string;
    client_id: string;
}

interface UserManagementProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UserManagement({ open, onOpenChange }: UserManagementProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [userClients, setUserClients] = useState<UserClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch all users
            const { data: profilesData, error: profilesError } = await supabase
                .from('profiles')
                .select('id, email, role, is_active, created_at, last_login_at')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            // Fetch all clients
            const { data: clientsData, error: clientsError } = await supabase
                .from('clients')
                .select('id, brand_name')
                .order('brand_name');

            if (clientsError) throw clientsError;

            // Fetch user-client associations
            const { data: userClientsData, error: userClientsError } = await supabase
                .from('user_clients')
                .select('user_id, client_id');

            if (userClientsError) throw userClientsError;

            setUsers(profilesData || []);
            setClients(clientsData || []);
            setUserClients(userClientsData || []);
        } catch (error) {
            console.error('Error fetching user management data:', error);
        } finally {
            setLoading(false);
        }
    };

    const assignBrandToUser = async (userId: string, clientId: string) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('user_clients')
                .insert({
                    user_id: userId,
                    client_id: clientId,
                    granted_by: user.id
                });

            if (error) throw error;

            // Refresh data
            fetchData();
        } catch (error) {
            console.error('Error assigning brand:', error);
            alert('Failed to assign brand to user');
        }
    };

    const removeBrandFromUser = async (userId: string, clientId: string) => {
        try {
            const { error } = await supabase
                .from('user_clients')
                .delete()
                .eq('user_id', userId)
                .eq('client_id', clientId);

            if (error) throw error;

            // Refresh data
            fetchData();
        } catch (error) {
            console.error('Error removing brand:', error);
            alert('Failed to remove brand from user');
        }
    };

    const toggleUserRole = async (userId: string, currentRole: 'admin' | 'user') => {
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;

            fetchData();
        } catch (error) {
            console.error('Error updating role:', error);
            alert('Failed to update user role');
        }
    };

    const getUserBrands = (userId: string) => {
        const brandIds = userClients.filter(uc => uc.user_id === userId).map(uc => uc.client_id);
        return clients.filter(c => brandIds.includes(c.id));
    };

    if (loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            User Management
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Users className="h-6 w-6" />
                        User Management
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                            <div className="text-sm text-blue-600 font-medium">Total Users</div>
                            <div className="text-2xl font-bold text-blue-900">{users.length}</div>
                        </div>
                        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                            <div className="text-sm text-purple-600 font-medium">Admins</div>
                            <div className="text-2xl font-bold text-purple-900">
                                {users.filter(u => u.role === 'admin').length}
                            </div>
                        </div>
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                            <div className="text-sm text-green-600 font-medium">Active Users</div>
                            <div className="text-2xl font-bold text-green-900">
                                {users.filter(u => u.is_active).length}
                            </div>
                        </div>
                    </div>

                    {/* Users List */}
                    <div className="space-y-3">
                        {users.map(user => {
                            const userBrands = getUserBrands(user.id);
                            const isExpanded = selectedUser === user.id;

                            return (
                                <div key={user.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                                                    <UserIcon className="h-5 w-5 text-white" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900">{user.email}</div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {user.role === 'admin' ? (
                                                            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
                                                                <Shield className="h-3 w-3 mr-1" />
                                                                Admin
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-gray-600">
                                                                <UserIcon className="h-3 w-3 mr-1" />
                                                                User
                                                            </Badge>
                                                        )}
                                                        {user.is_active ? (
                                                            <Badge className="bg-green-100 text-green-700">
                                                                <CheckCircle className="h-3 w-3 mr-1" />
                                                                Active
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-red-100 text-red-700">
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                        <span className="text-xs text-gray-500">
                                                            {userBrands.length} {userBrands.length === 1 ? 'brand' : 'brands'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Assigned Brands */}
                                            {userBrands.length > 0 && (
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    {userBrands.map(brand => (
                                                        <div
                                                            key={brand.id}
                                                            className="inline-flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs"
                                                        >
                                                            <span>{brand.brand_name}</span>
                                                            <button
                                                                onClick={() => removeBrandFromUser(user.id, brand.id)}
                                                                className="text-red-500 hover:text-red-700"
                                                            >
                                                                <XCircle className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => toggleUserRole(user.id, user.role)}
                                            >
                                                {user.role === 'admin' ? 'Make User' : 'Make Admin'}
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => setSelectedUser(isExpanded ? null : user.id)}
                                            >
                                                {isExpanded ? 'Hide' : 'Assign Brand'}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Brand Assignment Dropdown */}
                                    {isExpanded && (
                                        <div className="mt-4 pt-4 border-t">
                                            <div className="text-sm font-medium text-gray-700 mb-2">Assign Brand to {user.email}</div>
                                            <Select onValueChange={(value) => assignBrandToUser(user.id, value)}>
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select a brand to assign..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {clients
                                                        .filter(c => !getUserBrands(user.id).find(b => b.id === c.id))
                                                        .map(client => (
                                                            <SelectItem key={client.id} value={client.id}>
                                                                {client.brand_name}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
