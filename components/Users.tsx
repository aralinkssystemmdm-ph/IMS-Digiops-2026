
import React, { useState, useEffect } from 'react';
import { User, UserPlus, Search, Filter, MoreHorizontal, Trash2, Edit, Check, X, Loader2, Shield, RefreshCw, ChevronDown, Eye, EyeOff, AlertTriangle, Users as UsersIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from './NotificationProvider';
import { toTitleCase } from '../lib/utils';
import PageHeader from './PageHeader';

interface UserAccount {
  id: string;
  username: string;
  password?: string;
  full_name: string;
  first_name?: string;
  middle_initial?: string;
  last_name?: string;
  role: string;
  team?: string;
  office_based?: string;
  created_at?: string;
}

interface UsersProps {
  isDarkMode?: boolean;
  userRole?: string | null;
  currentUsername?: string | null;
}

const TEAMS = ['Aralinks', 'Protrack'] as const;

const parseTeams = (teamValue?: string | null): string[] => {
  if (!teamValue || typeof teamValue !== 'string' || !teamValue.trim()) return ['Aralinks'];
  const rawParts = teamValue.split(/[,;/|]+/).map(t => t.trim()).filter(Boolean);
  const result: string[] = [];

  for (const part of rawParts) {
    const matched = TEAMS.find(t => t.toLowerCase() === part.toLowerCase());
    const canonical = matched || (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase());
    if (!result.some(existing => existing.toLowerCase() === canonical.toLowerCase())) {
      result.push(canonical);
    }
  }

  return result.length > 0 ? result : ['Aralinks'];
};

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const Users: React.FC<UsersProps> = ({ isDarkMode = false, userRole = 'Staff', currentUsername = null }) => {
  const { showSuccess, showError, showWarning } = useNotification();
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<'ALL' | 'Aralinks' | 'Protrack'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Sorting state
  type SortField = 'name' | 'team' | 'office' | 'username' | 'role';
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Custom Dropdown states
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isOfficeDropdownOpen, setIsOfficeDropdownOpen] = useState(false);
  const [isEditRoleDropdownOpen, setIsEditRoleDropdownOpen] = useState(false);
  const [isEditOfficeDropdownOpen, setIsEditOfficeDropdownOpen] = useState(false);

  // Constants
  const ROLES = ['Super admin', 'Admin', 'Staff'];
  const OFFICES = ['PPH Main', 'Cebu', 'CDO', 'Davao'];

  // Use prop or fallback to localStorage to identify current user
  const loggedInUsername = currentUsername || localStorage.getItem('aralinks_user');

  const isSuperAdmin = userRole === 'Super admin';

  // Form State
  const [newUser, setNewUser] = useState({
    firstName: '',
    middleInitial: '',
    lastName: '',
    username: '',
    password: '',
    role: 'Staff',
    officeBased: 'PPH Main',
    teams: ['Aralinks'] as string[]
  });

  const toggleTeam = (teamName: string) => {
    setNewUser(prev => {
      const currentTeams = parseTeams(prev.teams.join(', '));
      const exists = currentTeams.some(t => t.toLowerCase() === teamName.toLowerCase());
      let next: string[];
      if (exists) {
        next = currentTeams.filter(t => t.toLowerCase() !== teamName.toLowerCase());
        if (next.length === 0) next = [teamName];
      } else {
        next = [...currentTeams, teamName];
      }
      return { ...prev, teams: parseTeams(next.join(', ')) };
    });
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchUsers();
    }
  }, [isSuperAdmin]);

  // Handle auto-generation of username and password
  useEffect(() => {
    if (newUser.firstName || newUser.lastName) {
      const generatedUsername = `${newUser.firstName.toLowerCase().replace(/\s+/g, '')}.${newUser.lastName.toLowerCase().replace(/\s+/g, '')}`;
      
      setNewUser(prev => {
        const updates: any = { username: generatedUsername };
        return { ...prev, ...updates };
      });
    }
  }, [newUser.firstName, newUser.lastName, isAddModalOpen]);

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let generatedPassword = "";
    for (let i = 0; i < 10; i++) {
      generatedPassword += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return generatedPassword;
  };

  // Reset and generate password when add modal opens
  useEffect(() => {
    if (isAddModalOpen) {
      setNewUser({
        firstName: '',
        middleInitial: '',
        lastName: '',
        username: '',
        password: generatePassword(),
        role: 'Staff',
        officeBased: 'PPH Main',
        teams: ['Aralinks']
      });
    }
  }, [isAddModalOpen]);

  if (!isSuperAdmin) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-12 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 text-red-500">
          <Shield size={40} />
        </div>
        <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Access Denied</h2>
        <p className="text-slate-500 max-w-md">You do not have the required permissions to view this page. Please contact your administrator if you believe this is an error.</p>
      </div>
    );
  }

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching users:', err);
      showError('Error', 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password || !newUser.firstName || !newUser.lastName) {
      showWarning('Required Fields', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName = `${newUser.firstName} ${(newUser.middleInitial || '').trim() ? (newUser.middleInitial || '').trim() + '. ' : ''}${newUser.lastName}`;
      
      // Check if username exists
      const { data: existingUser } = await supabase
        .from('user_accounts')
        .select('username')
        .eq('username', newUser.username.trim())
        .maybeSingle();

      if (existingUser) {
        throw new Error('Username already taken.');
      }

      const teamString = parseTeams(newUser.teams.join(', ')).join(', ');

      const { error } = await supabase
        .from('user_accounts')
        .insert([{
          username: newUser.username.trim(),
          password: newUser.password.trim(),
          full_name: fullName,
          first_name: newUser.firstName.trim(),
          middle_initial: (newUser.middleInitial || '').trim().substring(0, 1),
          last_name: newUser.lastName.trim(),
          role: newUser.role,
          office_based: newUser.officeBased,
          team: teamString
        }]);

      if (error) throw error;

      showSuccess('Success', 'User added successfully.');
      setIsAddModalOpen(false);
      setNewUser({
        firstName: '',
        middleInitial: '',
        lastName: '',
        username: '',
        password: '',
        role: 'Staff',
        officeBased: 'PPH Main',
        teams: ['Aralinks']
      });
      fetchUsers();
    } catch (err: any) {
      showError('Error', err.message || 'Failed to add user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('user_accounts')
        .delete()
        .eq('id', userToDelete.id);

      if (error) throw error;

      showSuccess('Deleted', 'User removed successfully.');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err: any) {
      console.error('Delete error:', err);
      showError('Error', err.message || 'Failed to delete user.');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (user: any) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleEditClick = (user: any) => {
    // Parse the name to fill the form
    const names = (user.full_name || '').split(' ');
    let firstName = names[0] || '';
    let lastName = names[names.length - 1] || '';
    let middleInitial = '';

    if (names.length > 2) {
      middleInitial = names[1].replace('.', '').trim();
    }

    setEditingUser(user);
    setNewUser({
      firstName: user.first_name || firstName,
      middleInitial: user.middle_initial || middleInitial,
      lastName: user.last_name || lastName,
      username: user.username,
      password: user.password || '',
      role: user.role,
      officeBased: user.office_based || 'PPH Main',
      teams: parseTeams(user.team)
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.firstName || !newUser.lastName) {
      showWarning('Required Fields', 'Please fill in all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullName = `${newUser.firstName.trim()} ${(newUser.middleInitial || '').trim() ? (newUser.middleInitial || '').trim().toUpperCase() + '. ' : ''}${newUser.lastName.trim()}`;
      const teamString = parseTeams(newUser.teams.join(', ')).join(', ');
      
      const { error } = await supabase
        .from('user_accounts')
        .update({
          username: newUser.username.trim(),
          password: newUser.password.trim(),
          full_name: fullName,
          first_name: newUser.firstName.trim(),
          middle_initial: (newUser.middleInitial || '').trim().substring(0, 1).toUpperCase(),
          last_name: newUser.lastName.trim(),
          role: newUser.role,
          office_based: newUser.officeBased,
          team: teamString
        })
        .match({ id: editingUser.id });

      if (error) throw error;

      showSuccess('Success', 'User updated successfully.');
      setIsEditModalOpen(false);
      setEditingUser(null);
      setNewUser({
        firstName: '',
        middleInitial: '',
        lastName: '',
        username: '',
        password: '',
        role: 'Staff',
        officeBased: 'PPH Main',
        teams: ['Aralinks']
      });
      fetchUsers();
    } catch (err: any) {
      showError('Error', err.message || 'Failed to update user.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = React.useMemo(() => {
    let list = users.filter(user => {
      // Team filter
      if (teamFilter !== 'ALL') {
        const userTeams = parseTeams(user.team);
        const matchesTeam = userTeams.some(t => t.toLowerCase() === teamFilter.toLowerCase());
        if (!matchesTeam) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          (user.full_name || '').toLowerCase().includes(query) ||
          (user.username || '').toLowerCase().includes(query) ||
          (user.role || '').toLowerCase().includes(query) ||
          (user.office_based || '').toLowerCase().includes(query) ||
          (user.team || '').toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      return true;
    });

    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.full_name || '').localeCompare(b.full_name || '');
          break;
        case 'team': {
          const aTeams = parseTeams(a.team).join(', ');
          const bTeams = parseTeams(b.team).join(', ');
          comparison = aTeams.localeCompare(bTeams);
          break;
        }
        case 'office':
          comparison = (a.office_based || '').localeCompare(b.office_based || '');
          break;
        case 'username':
          comparison = (a.username || '').localeCompare(b.username || '');
          break;
        case 'role':
          comparison = (a.role || '').localeCompare(b.role || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    // Pin current user to top if found in filtered results
    if (loggedInUsername) {
      const currentUserIdx = list.findIndex(u => u.username?.toLowerCase().trim() === loggedInUsername.toLowerCase().trim());
      if (currentUserIdx !== -1) {
        const [currentUserObj] = list.splice(currentUserIdx, 1);
        return [currentUserObj, ...list];
      }
    }

    return list;
  }, [users, teamFilter, searchQuery, sortField, sortDirection, loggedInUsername]);

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-500">
      <div className="px-6 lg:px-12 pt-0 pb-2">
        <PageHeader 
          title="Users" 
          description="Manage system access and registration" 
          isDarkMode={isDarkMode} 
        />
      </div>

      {/* Search, Team Filter and Add Action Bar */}
      <div className="px-6 lg:px-12 pt-0 pb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-3xl">
          {/* Search Bar */}
          <div className="relative flex-1 group min-w-[240px]">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[var(--brand-accent)] transition-colors">
              <Search size={18} />
            </div>
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-12 pl-12 pr-4 rounded-2xl border transition-all outline-none text-sm font-medium ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-white focus:bg-slate-800' 
                  : 'bg-white border-slate-100 text-slate-700 focus:bg-[#FAF8F8]'
              }`}
              style={{ 
                borderColor: searchQuery ? 'var(--brand-accent)' : undefined,
                '--tw-ring-color': 'var(--brand-accent)'
              } as any}
            />
          </div>

          {/* Team Filter Button Group */}
          <div className={`flex items-center p-1 rounded-2xl border ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
          } shadow-sm shrink-0 overflow-x-auto custom-scrollbar`}>
            {(['ALL', 'Aralinks', 'Protrack'] as const).map((t) => {
              const isSelected = teamFilter === t;
              const count = t === 'ALL' 
                ? users.length 
                : users.filter(u => parseTeams(u.team).some(item => item.toLowerCase() === t.toLowerCase())).length;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTeamFilter(t)}
                  className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                    isSelected 
                      ? 'text-white shadow-md' 
                      : isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                  style={isSelected ? {
                    backgroundColor: 'var(--brand-accent)',
                    color: '#ffffff'
                  } : {}}
                >
                  <span>{t === 'ALL' ? 'All Teams' : t}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    isSelected ? 'bg-white/20 text-white' : isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="h-12 px-8 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 self-end md:self-auto"
          style={{ 
            backgroundColor: 'var(--brand-accent)',
            boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)'
          }}
        >
          <UserPlus size={18} />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="flex-grow overflow-auto px-6 lg:px-12 pb-12 custom-scrollbar">
        <div className={`rounded-3xl border overflow-hidden shadow-sm ${
          isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
        }`}>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className={`${isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50'} border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                <th onClick={() => handleSort('name')} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Name</span>
                    {sortField === 'name' && (
                      <span style={{ color: 'var(--brand-accent)' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('team')} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Team</span>
                    {sortField === 'team' && (
                      <span style={{ color: 'var(--brand-accent)' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('office')} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Office Based</span>
                    {sortField === 'office' && (
                      <span style={{ color: 'var(--brand-accent)' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('username')} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Username</span>
                    {sortField === 'username' && (
                      <span style={{ color: 'var(--brand-accent)' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th onClick={() => handleSort('role')} className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <span>Role</span>
                    {sortField === 'role' && (
                      <span style={{ color: 'var(--brand-accent)' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
                <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr key="loading-spinner">
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto mb-3" style={{ color: 'var(--brand-accent)' }} size={32} />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading users data...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr key="no-users-found">
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                      <Search size={28} />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">No users found</p>
                    <p className="text-xs text-slate-500 font-medium tracking-wide">Try adjusting your search or team filter criteria</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user, index) => {
                  const isSelf = user.username?.toLowerCase().trim() === loggedInUsername?.toLowerCase().trim();
                  return (
                    <tr key={user.id || `user-idx-${index}`} className="group transition-colors"
                      style={isSelf ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 95%)' } : {}}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm uppercase shadow-sm shrink-0"
                            style={isSelf ? { backgroundColor: 'var(--brand-accent)', color: 'white' } : { backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' }}
                          >
                            {getInitials(user.full_name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-black text-slate-800 dark:text-white tracking-tight">{user.full_name || 'Unnamed User'}</p>
                              {isSelf && (
                                <span className="text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full uppercase tracking-wider"
                                  style={{ backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' }}
                                >
                                  You
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {parseTeams(user.team).map((t) => {
                            const isAralinks = t.toLowerCase() === 'aralinks';
                            return (
                              <span
                                key={t}
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                  isAralinks
                                    ? isDarkMode 
                                      ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' 
                                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                                    : isDarkMode 
                                      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' 
                                      : 'bg-purple-50 text-purple-600 border border-purple-200'
                                }`}
                              >
                                {t}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-600 dark:text-slate-400 tracking-tight">{user.office_based || 'PPH Main'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-mono font-bold" style={{ color: 'var(--brand-accent)' }}>
                          <User size={14} />
                          <span>{user.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                          user.role.toLowerCase() === 'super admin'
                            ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                            : user.role.toLowerCase() === 'admin' 
                            ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' 
                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                        }`}>
                          <Shield size={12} />
                          <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{user.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 transition-opacity">
                          <button 
                            onClick={() => handleEditClick(user)}
                            className="p-2 text-slate-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-xl transition-all" 
                            style={{ '--hover-color': 'var(--brand-accent)' } as any}
                            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-accent)'}
                            onMouseLeave={(e) => e.currentTarget.style.color = ''}
                            title="Edit User"
                          >
                            <Edit size={16} strokeWidth={2.5} />
                          </button>
                          <button 
                            onClick={() => !isSelf && confirmDelete(user)}
                            disabled={isSelf}
                            className={`p-2 rounded-xl transition-all ${
                              isSelf 
                                ? 'opacity-40 cursor-not-allowed text-slate-400' 
                                : 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                            }`} 
                            title={isSelf ? "Cannot delete your own account" : "Remove User"}
                          >
                            <Trash2 size={16} strokeWidth={2.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => !isDeleting && setIsDeleteModalOpen(false)} />
          <div className={`relative w-full max-w-[420px] rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
          }`}>
            <div className="p-8 flex flex-col items-center text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner ${
                isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-500'
              }`}>
                <Trash2 size={40} />
              </div>
              
              <h3 className={`text-2xl font-black tracking-tight mb-2 ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                Remove User?
              </h3>
              
              <p className={`text-sm font-medium leading-relaxed mb-6 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                You are about to <span className="text-red-500 font-bold uppercase tracking-tighter">permanently delete</span> <span className={`font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{userToDelete?.full_name}</span>.
                <br />
                <span className="flex items-center justify-center gap-1 mt-2 text-red-500 font-bold">
                  <AlertTriangle size={14} />
                  This action cannot be undone.
                </span>
              </p>

              <div className="flex flex-col w-full gap-3">
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={isDeleting}
                  className="w-full py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={18} />
                      Confirm Delete
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleting}
                  className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
            
            <button 
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
              className={`absolute top-6 right-6 p-2 transition-colors ${
                isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'
              }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsEditModalOpen(false)} />
          <div className={`relative w-full max-w-[520px] rounded-[2.5rem] shadow-2xl overflow-visible animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
          }`}>
            <form onSubmit={handleUpdateUser} className="p-8 sm:p-10 space-y-6" autoComplete="off">
              {/* Decoy inputs to trick browser autocomplete heuristics */}
              <input type="text" style={{ display: 'none' }} name="fake-username-to-prevent-save-password-edit" />
              <input type="password" style={{ display: 'none' }} name="fake-password-to-prevent-save-password-edit" />
              
              <div className="flex items-center justify-between mb-2 text-center sm:text-left">
                <div>
                  <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Edit User</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Update system access</p>
                </div>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-[1fr,80px,1fr] gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">First Name</label>
                    <input 
                      type="text" 
                      required
                      name="edit-first-name"
                      autoComplete="off"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.firstName ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 text-center">M.I.</label>
                    <input 
                      type="text" 
                      maxLength={1}
                      name="edit-mi"
                      value={newUser.middleInitial}
                      onChange={(e) => setNewUser({...newUser, middleInitial: e.target.value})}
                      className={`w-full h-11 px-2 text-center rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.middleInitial ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="M"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Last Name</label>
                    <input 
                      type="text" 
                      required
                      name="edit-last-name"
                      autoComplete="off"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.lastName ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Username</label>
                  </div>
                    <input 
                      type="text" 
                      required
                      name="user-account-id-entry"
                      autoComplete="chrome-off"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-orange-50/30 border-orange-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.username ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="Enter username"
                    />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Password</label>
                    <button 
                      type="button" 
                      onClick={() => setNewUser(p => ({ ...p, password: generatePassword() }))}
                      className="text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 transition-colors hover:opacity-80"
                      style={{ color: 'var(--brand-accent)' }}
                    >
                      <RefreshCw size={10} /> Regenerate
                    </button>
                  </div>
                  <div className="relative group">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      name="user-secret-access-key"
                      autoComplete="new-password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className={`w-full h-11 px-4 pr-12 rounded-xl border transition-all text-sm font-mono font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-orange-50/30 border-orange-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.password ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 h-11 w-12 flex items-center justify-center text-slate-400 transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-accent)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = ''}
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>

                {/* Team Multi-Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Assigned Team(s)
                    </label>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Multiple selection allowed
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TEAMS.map((teamName) => {
                      const isSelected = newUser.teams.includes(teamName);
                      const isAralinks = teamName === 'Aralinks';
                      return (
                        <button
                          key={teamName}
                          type="button"
                          onClick={() => toggleTeam(teamName)}
                          className={`h-11 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all border ${
                            isSelected
                              ? isAralinks
                                ? isDarkMode 
                                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm' 
                                  : 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                : isDarkMode 
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm' 
                                  : 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                              : isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/60'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isAralinks ? 'bg-blue-500' : 'bg-purple-500'}`} />
                            {teamName}
                          </span>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? isAralinks
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-purple-600 border-purple-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Role</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsEditRoleDropdownOpen(!isEditRoleDropdownOpen)}
                        className={`w-full h-11 px-4 pr-10 rounded-xl border transition-all text-sm font-bold outline-none flex items-center justify-between group ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white' 
                            : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-1 shadow-sm'
                        }`}
                        style={{ borderColor: isEditRoleDropdownOpen ? 'var(--brand-accent)' : undefined, '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)' } as any}
                      >
                        <span>{newUser.role}</span>
                        <ChevronDown 
                          size={16} 
                          strokeWidth={3} 
                          className={`text-slate-400 transition-transform duration-200 ${isEditRoleDropdownOpen ? 'rotate-180' : ''}`} 
                          style={isEditRoleDropdownOpen ? { color: 'var(--brand-accent)' } : {}}
                        />
                      </button>

                      {isEditRoleDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsEditRoleDropdownOpen(false)} />
                          <div className={`absolute z-20 w-full mt-2 rounded-xl shadow-xl border animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                          }`}>
                            {ROLES.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  setNewUser({...newUser, role});
                                  setIsEditRoleDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors flex items-center justify-between ${
                                  newUser.role === role 
                                    ? 'bg-orange-50/10' 
                                    : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                                style={newUser.role === role ? { color: 'var(--brand-accent)' } : {}}
                              >
                                {role}
                                {newUser.role === role && <Check size={14} strokeWidth={3} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Office Based</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsEditOfficeDropdownOpen(!isEditOfficeDropdownOpen)}
                        className={`w-full h-11 px-4 pr-10 rounded-xl border transition-all text-sm font-bold outline-none flex items-center justify-between group ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white' 
                            : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-1 shadow-sm'
                        }`}
                        style={{ borderColor: isEditOfficeDropdownOpen ? 'var(--brand-accent)' : undefined, '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)' } as any}
                      >
                        <span>{newUser.officeBased}</span>
                        <ChevronDown 
                          size={16} 
                          strokeWidth={3} 
                          className={`text-slate-400 transition-transform duration-200 ${isEditOfficeDropdownOpen ? 'rotate-180' : ''}`} 
                          style={isEditOfficeDropdownOpen ? { color: 'var(--brand-accent)' } : {}}
                        />
                      </button>

                      {isEditOfficeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsEditOfficeDropdownOpen(false)} />
                          <div className={`absolute z-20 w-full mt-2 rounded-xl shadow-xl border animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                          }`}>
                            {OFFICES.map((office) => (
                              <button
                                key={office}
                                type="button"
                                onClick={() => {
                                  setNewUser({...newUser, officeBased: office});
                                  setIsEditOfficeDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors flex items-center justify-between ${
                                  newUser.officeBased === office 
                                    ? 'bg-orange-50/10' 
                                    : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                                style={newUser.officeBased === office ? { color: 'var(--brand-accent)' } : {}}
                              >
                                {office}
                                {newUser.officeBased === office && <Check size={14} strokeWidth={3} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className={`flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 h-12 px-10 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--brand-accent)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)' }}
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAddModalOpen(false)} />
          <div className={`relative w-full max-w-[520px] rounded-[2.5rem] shadow-2xl overflow-visible animate-in zoom-in-95 duration-200 ${
            isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'
          }`}>
            <form onSubmit={handleAddUser} className="p-8 sm:p-10 space-y-6" autoComplete="off">
              {/* Decoy inputs to trick browser autocomplete heuristics */}
              <input type="text" style={{ display: 'none' }} name="fake-username-to-prevent-save-password-add" />
              <input type="password" style={{ display: 'none' }} name="fake-password-to-prevent-save-password-add" />

              <div className="flex items-center justify-between mb-2 text-center sm:text-left">
                <div>
                  <h3 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Add New User</h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Register system access</p>
                </div>
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-[1fr,80px,1fr] gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">First Name</label>
                    <input 
                      type="text" 
                      required
                      name="add-first-name"
                      autoComplete="off"
                      value={newUser.firstName}
                      onChange={(e) => setNewUser({...newUser, firstName: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.firstName ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1 text-center">M.I.</label>
                    <input 
                      type="text" 
                      name="add-mi"
                      maxLength={1}
                      value={newUser.middleInitial}
                      onChange={(e) => setNewUser({...newUser, middleInitial: e.target.value})}
                      className={`w-full h-11 px-2 text-center rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.middleInitial ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="M"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Last Name</label>
                    <input 
                      type="text" 
                      required
                      name="add-last-name"
                      autoComplete="off"
                      value={newUser.lastName}
                      onChange={(e) => setNewUser({...newUser, lastName: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.lastName ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="Last name"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Username</label>
                  </div>
                    <input 
                      type="text" 
                      required
                      name="new-entry-user-id"
                      autoComplete="chrome-off"
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className={`w-full h-11 px-4 rounded-xl border transition-all text-sm font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-orange-50/30 border-orange-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.username ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="Enter username"
                    />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Password</label>
                    <button 
                      type="button" 
                      onClick={() => setNewUser(p => ({ ...p, password: generatePassword() }))}
                      className="text-[9px] font-black uppercase tracking-tighter flex items-center gap-1 transition-colors"
                      style={{ color: 'var(--brand-accent)' }}
                    >
                      <RefreshCw size={10} /> Regenerate
                    </button>
                  </div>
                  <div className="relative group">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      required
                      name="new-entry-cipher"
                      autoComplete="new-password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className={`w-full h-11 px-4 pr-12 rounded-xl border transition-all text-sm font-mono font-bold outline-none ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-orange-50/30 border-orange-100 text-slate-800'
                      }`}
                      style={{ borderColor: newUser.password ? 'var(--brand-accent)' : undefined } as any}
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0 top-0 h-11 w-12 flex items-center justify-center text-slate-400 transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand-accent)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = ''}
                    >
                      {showPassword ? <EyeOff size={18} strokeWidth={2.5} /> : <Eye size={18} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>

                {/* Team Multi-Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Assigned Team(s)
                    </label>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      Multiple selection allowed
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {TEAMS.map((teamName) => {
                      const isSelected = newUser.teams.includes(teamName);
                      const isAralinks = teamName === 'Aralinks';
                      return (
                        <button
                          key={teamName}
                          type="button"
                          onClick={() => toggleTeam(teamName)}
                          className={`h-11 px-3.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all border ${
                            isSelected
                              ? isAralinks
                                ? isDarkMode 
                                  ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-sm' 
                                  : 'bg-blue-50 border-blue-300 text-blue-700 shadow-sm'
                                : isDarkMode 
                                  ? 'bg-purple-500/20 border-purple-500 text-purple-300 shadow-sm' 
                                  : 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                              : isDarkMode
                                ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700/60'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isAralinks ? 'bg-blue-500' : 'bg-purple-500'}`} />
                            {teamName}
                          </span>
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                            isSelected
                              ? isAralinks
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-purple-600 border-purple-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700'
                          }`}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Role</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                        className={`w-full h-11 px-4 pr-10 rounded-xl border transition-all text-sm font-bold outline-none flex items-center justify-between group ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white' 
                            : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-1 shadow-sm'
                        }`}
                        style={{ borderColor: isRoleDropdownOpen ? 'var(--brand-accent)' : undefined, '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)' } as any}
                      >
                        <span>{newUser.role}</span>
                        <ChevronDown 
                          size={16} 
                          strokeWidth={3} 
                          className={`text-slate-400 transition-transform duration-200 ${isRoleDropdownOpen ? 'rotate-180' : ''}`} 
                          style={isRoleDropdownOpen ? { color: 'var(--brand-accent)' } : {}}
                        />
                      </button>

                      {isRoleDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsRoleDropdownOpen(false)} />
                          <div className={`absolute z-20 w-full mt-2 rounded-xl shadow-xl border animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                          }`}>
                            {ROLES.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  setNewUser({...newUser, role});
                                  setIsRoleDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors flex items-center justify-between ${
                                  newUser.role === role 
                                    ? 'bg-orange-50/10' 
                                    : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                                style={newUser.role === role ? { color: 'var(--brand-accent)' } : {}}
                              >
                                {role}
                                {newUser.role === role && <Check size={14} strokeWidth={3} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">Office Based</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsOfficeDropdownOpen(!isOfficeDropdownOpen)}
                        className={`w-full h-11 px-4 pr-10 rounded-xl border transition-all text-sm font-bold outline-none flex items-center justify-between group ${
                          isDarkMode 
                            ? 'bg-slate-800 border-slate-700 text-white' 
                            : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-1 shadow-sm'
                        }`}
                        style={{ borderColor: isOfficeDropdownOpen ? 'var(--brand-accent)' : undefined, '--tw-ring-color': 'color-mix(in srgb, var(--brand-accent), transparent 80%)' } as any}
                      >
                        <span>{newUser.officeBased}</span>
                        <ChevronDown 
                          size={16} 
                          strokeWidth={3} 
                          className={`text-slate-400 transition-transform duration-200 ${isOfficeDropdownOpen ? 'rotate-180' : ''}`} 
                          style={isOfficeDropdownOpen ? { color: 'var(--brand-accent)' } : {}}
                        />
                      </button>

                      {isOfficeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsOfficeDropdownOpen(false)} />
                          <div className={`absolute z-20 w-full mt-2 rounded-xl shadow-xl border animate-in fade-in zoom-in-95 duration-200 overflow-hidden ${
                            isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                          }`}>
                            {OFFICES.map((office) => (
                              <button
                                key={office}
                                type="button"
                                onClick={() => {
                                  setNewUser({...newUser, officeBased: office});
                                  setIsOfficeDropdownOpen(false);
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm font-bold transition-colors flex items-center justify-between ${
                                  newUser.officeBased === office 
                                    ? 'bg-orange-50/10' 
                                    : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                                }`}
                                style={newUser.officeBased === office ? { color: 'var(--brand-accent)' } : {}}
                              >
                                {office}
                                {newUser.officeBased === office && <Check size={14} strokeWidth={3} />}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className={`flex-1 h-12 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                    isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-2 h-12 px-10 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                  style={{ backgroundColor: 'var(--brand-accent)', boxShadow: '0 10px 15px -3px color-mix(in srgb, var(--brand-accent), transparent 80%)' }}
                >
                  {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  Confirm Add
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
