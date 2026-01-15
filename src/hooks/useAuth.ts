import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type UserRole = 'admin' | 'agency' | 'user';

export interface AuthUser extends User {
    role?: UserRole;
    isActive?: boolean;
}

export interface UseAuthReturn {
    user: AuthUser | null;
    role: UserRole;
    isAdmin: boolean;
    isAgency: boolean;
    isActive: boolean;
    loading: boolean;
    assignedClientIds: string[];
    refreshAuth: () => Promise<void>;
    checkPermission: (permission: string) => boolean;
}

/**
 * Custom hook for authentication and role-based access control
 * Provides user data, role, and permission checks
 */
export function useAuth(): UseAuthReturn {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [role, setRole] = useState<UserRole>('user');
    const [isActive, setIsActive] = useState(true);
    const [loading, setLoading] = useState(true);
    const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);

    const fetchUserData = useCallback(async () => {
        try {
            // Get current user from Supabase Auth
            const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

            if (authError || !authUser) {
                setUser(null);
                setRole('user');
                setIsActive(false);
                setLoading(false);
                return;
            }

            // Fetch user profile with role
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role, is_active')
                .eq('id', authUser.id)
                .single();

            if (profileError) {
                console.error('Error fetching user profile:', profileError);
                setUser(authUser as AuthUser);
                setRole('user');
                setIsActive(true);
            } else {
                setUser({ ...authUser, role: profile?.role as UserRole, isActive: profile?.is_active } as AuthUser);
                setRole(profile?.role || 'user');
                setIsActive(profile?.is_active !== false);
            }

            // Fetch assigned clients for normal users
            if (profile?.role !== 'admin') {
                const { data: userClients, error: clientsError } = await supabase
                    .from('user_clients')
                    .select('client_id')
                    .eq('user_id', authUser.id);

                if (!clientsError && userClients) {
                    setAssignedClientIds(userClients.map(uc => uc.client_id));
                }
            }

            // Update last login
            await supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', authUser.id);

        } catch (error) {
            console.error('Error in fetchUserData:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUserData();

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, _session) => {
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                fetchUserData();
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
                setRole('user');
                setIsActive(false);
                setAssignedClientIds([]);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [fetchUserData]);

    const checkPermission = useCallback((permission: string): boolean => {
        // Admin has all permissions
        if (role === 'admin') return true;

        // Agency permissions (expanded access)
        const agencyPermissions = [
            'view_overview',
            'view_prompts',
            'add_prompts',
            'run_audits',
            'view_sources',
            'view_content',
            'generate_content',
            'view_insights',
            'export_data',
            'view_intelligence',
            'view_signals',
            'manage_brands'
        ];

        // Define permission mappings for normal users
        const userPermissions = [
            'view_overview',
            'view_prompts',
            'add_prompts',
            'run_audits',
            'view_sources',
            'view_content',
            'generate_content',
            'view_insights',
            'export_data'
        ];

        // Admin-only permissions
        const adminPermissions = [
            'view_campaigns',
            'create_campaigns',
            'view_analytics',
            'view_schedules',
            'create_schedules',
            'manage_users',
            'view_all_data'
        ];

        // Check agency permissions first
        if (role === 'agency') {
            if (agencyPermissions.includes(permission)) return true;
            if (adminPermissions.includes(permission)) return false;
            return false;
        }

        // Normal user permissions
        if (userPermissions.includes(permission)) return true;
        if (adminPermissions.includes(permission)) return false;

        return false;
    }, [role]);

    return {
        user,
        role,
        isAdmin: role === 'admin',
        isAgency: role === 'agency',
        isActive,
        loading,
        assignedClientIds,
        refreshAuth: fetchUserData,
        checkPermission
    };
}
