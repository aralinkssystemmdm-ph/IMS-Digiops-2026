
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Settings, 
  Bell, 
  Moon, 
  Box, 
  Package, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  MapPin,
  Building2,
  FileText,
  Tag,
  Calendar
} from 'lucide-react';
import { toTitleCase } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  subWeeks, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  isSameDay,
  isSameMonth,
  subMonths,
  subYears,
  eachYearOfInterval,
  isSameYear,
  isWithinInterval
} from 'date-fns';

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  type: 'Item' | 'Request' | 'School' | 'Location';
  status?: string;
  stock?: number;
  location?: string;
  originalData: any;
}

interface SchoolStatus {
  schoolName: string;
  totalRequests: number;
  deliveredRequests: number;
  partialRequests: number;
  pendingRequests: number;
  completionPercentage: number;
  overallStatus: 'Delivered' | 'Partially Delivered' | 'Pending';
}

interface FeaturesProps {
  onNavigate?: (view: string, params?: { requestId?: string; tab?: 'equipment' | 'bundle'; status?: 'All' | 'Pending' | 'Partially' | 'Completed' }) => void;
  userName?: string;
  isDarkMode?: boolean;
}

const Features: React.FC<FeaturesProps> = ({ onNavigate, userName = 'User', isDarkMode = false }) => {
  const [stats, setStats] = useState({
    pending: 0,
    partiallyDelivered: 0,
    rejected: 0,
    completed: 0,
    totalItems: 0,
    totalSchools: 0,
    totalRequests: 0,
    completionRate: 93
  });
  const [schoolStats, setSchoolStats] = useState<SchoolStatus[]>([]);
  const [schoolStatusDistribution, setSchoolStatusDistribution] = useState({
    delivered: 0,
    partial: 0,
    pending: 0,
    total: 0
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [inventoryStocks, setInventoryStocks] = useState<any[]>([]);
  const [locationDistribution, setLocationDistribution] = useState<{location: string, count: number}[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'all' | 'this-week' | 'last-week' | 'months' | 'years'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<{ [key: string]: SearchResult[] }>({});
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [searchContext, setSearchContext] = useState<'filtered' | 'all-time'>('all-time');
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('aralinks_recent_searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches', e);
      }
    }
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== query.toLowerCase());
      const updated = [query, ...filtered].slice(0, 5);
      localStorage.setItem('aralinks_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const removeRecentSearch = (e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(q => q !== query);
      localStorage.setItem('aralinks_recent_searches', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || !isSupabaseConfigured) {
      setSearchResults({});
      setIsSearchDropdownOpen(false);
      return;
    }

    setIsSearching(true);
    setIsSearchDropdownOpen(true);

    try {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;

      if (searchContext === 'filtered') {
        switch (timeFilter) {
          case 'this-week':
            startDate = startOfWeek(now);
            endDate = endOfWeek(now);
            break;
          case 'last-week':
            startDate = startOfWeek(subWeeks(now, 1));
            endDate = endOfWeek(subWeeks(now, 1));
            break;
          case 'months':
            startDate = startOfMonth(now);
            endDate = endOfMonth(now);
            break;
          case 'years':
            startDate = startOfYear(now);
            endDate = endOfYear(now);
            break;
        }
      }

      const [itemsRes, requestsRes, schoolsRes] = await Promise.all([
        supabase.from('equipment').select('*').ilike('description', `%${query}%`).limit(5),
        supabase.from('item_requests').select('*').or(`school_name.ilike.%${query}%,control_no.ilike.%${query}%,location.ilike.%${query}%`).limit(10),
        supabase.from('schools').select('*').ilike('name', `%${query}%`).limit(5)
      ]);

      const results: { [key: string]: SearchResult[] } = {
        Items: [],
        Requests: [],
        Schools: [],
        Locations: []
      };

      if (itemsRes.data) {
        results.Items = itemsRes.data.map(item => ({
          id: item.id,
          title: item.description || item.name,
          subtitle: `Code: ${item.code}`,
          type: 'Item',
          stock: item.stock,
          originalData: item
        }));
      }

      if (requestsRes.data) {
        const filteredRequests = requestsRes.data.filter(req => {
          if (!startDate || !endDate) return true;
          const reqDate = new Date(req.created_at);
          return isWithinInterval(reqDate, { start: startDate, end: endDate });
        });

        results.Requests = filteredRequests.map(req => ({
          id: req.control_no,
          title: req.control_no,
          subtitle: `${req.school_name} - ${req.status}`,
          type: 'Request',
          status: req.status,
          originalData: req
        }));

        // Extract unique locations from requests
        const locations = Array.from(new Set(requestsRes.data.map(req => req.location))).filter(loc => loc && loc.toLowerCase().includes(query.toLowerCase()));
        results.Locations = locations.map(loc => ({
          id: loc,
          title: loc,
          subtitle: 'Inventory Location',
          type: 'Location',
          originalData: { location: loc }
        }));
      }

      if (schoolsRes.data) {
        results.Schools = schoolsRes.data.map(school => ({
          id: school.id,
          title: school.name,
          subtitle: school.address || 'School Location',
          type: 'School',
          originalData: school
        }));
      }

      // Remove empty categories
      const finalResults: { [key: string]: SearchResult[] } = {};
      Object.keys(results).forEach(key => {
        if (results[key].length > 0) {
          finalResults[key] = results[key];
        }
      });

      setSearchResults(finalResults);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [timeFilter, searchContext]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="font-bold" style={{ color: 'var(--brand-accent)' }}>{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  const handleResultClick = (result: SearchResult) => {
    saveRecentSearch(searchQuery || result.title);
    setIsSearchDropdownOpen(false);
    setSearchQuery('');
    
    if (result.type === 'Item') {
      onNavigate?.('catalog', { tab: 'equipment' });
    } else if (result.type === 'Request') {
      const status = (result.originalData.status === 'Complete' || result.originalData.status === 'Delivered') ? 'Completed' : 
                     (result.originalData.status === 'Partially Delivered') ? 'Partially' : 'Pending';
      onNavigate?.('requests', { requestId: result.id, status });
    } else if (result.type === 'School') {
      onNavigate?.('school');
    } else if (result.type === 'Location') {
      onNavigate?.('location');
    }
  };

  const fetchDashboardData = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    
    try {
      const now = new Date();
      let startDate: Date | null = null;
      let endDate: Date | null = null;
      let interval: Date[] = [];
      let groupingFormat: string = 'MMM';

      switch (timeFilter) {
        case 'all':
          startDate = null;
          endDate = null;
          // For "All" chart view, show months of the current year for better detail
          const currentYearStart = startOfYear(now);
          const currentYearEnd = endOfYear(now);
          interval = eachMonthOfInterval({ start: currentYearStart, end: currentYearEnd });
          groupingFormat = 'MMM';
          break;
        case 'this-week':
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          interval = eachDayOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'EEE'; // Mon, Tue...
          break;
        case 'last-week':
          const lastWeek = subWeeks(now, 1);
          startDate = startOfWeek(lastWeek);
          endDate = endOfWeek(lastWeek);
          interval = eachDayOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'EEE';
          break;
        case 'months':
          startDate = startOfYear(now);
          endDate = endOfYear(now);
          interval = eachMonthOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'MMM'; // Jan, Feb...
          break;
        case 'years':
          startDate = subYears(now, 4);
          endDate = now;
          interval = eachYearOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'yyyy';
          break;
        default:
          startDate = startOfWeek(now);
          endDate = endOfWeek(now);
          interval = eachDayOfInterval({ start: startDate, end: endDate });
          groupingFormat = 'EEE';
      }

      // Fetch counts and data
      const getFilteredQuery = (status: string | string[] | null = null, orderBy: string = 'created_at', isCountOnly: boolean = false) => {
        let query = supabase.from('item_requests').select('*', { count: isCountOnly ? 'exact' : undefined, head: isCountOnly });
        
        if (status) {
          if (Array.isArray(status)) {
            query = query.in('status', status);
          } else {
            query = query.eq('status', status);
          }
          
          const isCancelledStatus = Array.isArray(status) 
            ? status.includes('Rejected') || status.includes('Deleted')
            : status === 'Rejected' || status === 'Deleted';

          if (!isCancelledStatus) {
            query = query.is('archived_at', null);
          }
        }

        if (timeFilter !== 'all' && startDate && endDate) {
          const filterField = orderBy === 'delivered_at' ? 'delivered_at' : 'created_at';
          query = query.gte(filterField, startDate.toISOString()).lte(filterField, endDate.toISOString());
        }

        if (!isCountOnly) {
          query = query.order(orderBy, { ascending: false }).limit(5);
        }

        return query;
      };
      
      const [
        pendingRes,
        partiallyDeliveredRes,
        rejectedRes,
        completedRes,
        itemsRes,
        schoolsRes,
        recentCreatedRes,
        recentCompletedRes,
        stocksRes,
        distributionRes,
        chartRequestsRes,
        allRequestsItemsRes
      ] = await Promise.all([
        getFilteredQuery('Pending', 'created_at', true),
        getFilteredQuery('Partially Delivered', 'created_at', true),
        getFilteredQuery(['Rejected', 'Deleted'], 'created_at', true),
        getFilteredQuery(['Complete', 'Delivered'], 'created_at', true),
        supabase.from('equipment').select('*', { count: 'exact', head: true }),
        supabase.from('schools').select('*', { count: 'exact', head: true }),
        getFilteredQuery(null, 'created_at', false),
        getFilteredQuery(['Complete', 'Delivered', 'Partially Delivered'], 'delivered_at', false),
        supabase.from('view_inventory_summary').select('item_name, total_quantity, critical_level').order('total_quantity', { ascending: true }).limit(6),
        supabase.from('item_location_stocks').select('location, quantity'),
        timeFilter === 'all' 
          ? supabase.from('item_requests').select('created_at')
          : supabase.from('item_requests').select('created_at').gte('created_at', startDate!.toISOString()).lte('created_at', endDate!.toISOString()),
        supabase.from('item_requests')
          .select('control_no, status, school_name, request_items(qty, received_quantity)')
          .not('status', 'in', '("Deleted","Rejected")')
          .is('archived_at', null)
      ]);

      const pending = pendingRes.count || 0;
      const partiallyDelivered = partiallyDeliveredRes.count || 0;
      const rejected = rejectedRes.count || 0;
      const completed = completedRes.count || 0;
  const totalRelevant = partiallyDelivered + completed;
  
  // Calculate overall completion percentage based on item-level progress
  let totalWeightedPercentage = 0;
  const allReqs = allRequestsItemsRes.data || [];
  const validReqsCount = allReqs.length;
  
  allReqs.forEach(req => {
    const items = (req.request_items as any[]) || [];
    const reqTotal = items.reduce((s, i) => s + (parseInt(i.qty) || 0), 0);
    const reqDel = items.reduce((s, i) => s + (parseInt(i.received_quantity) || 0), 0);
    if (reqTotal > 0) {
      totalWeightedPercentage += (reqDel / reqTotal);
    }
  });
  
  const overallRate = validReqsCount > 0 ? Math.round((totalWeightedPercentage / validReqsCount) * 100) : 0;

  // Calculate school-specific stats
  const schoolGroups: Record<string, any[]> = {};
  allReqs.forEach(req => {
    const sName = req.school_name || 'Unknown School';
    if (!schoolGroups[sName]) schoolGroups[sName] = [];
    schoolGroups[sName].push(req);
  });

  const computedSchoolStats: SchoolStatus[] = Object.entries(schoolGroups).map(([name, reqs]) => {
    let sDelivered = 0;
    let sPartial = 0;
    let sPending = 0;
    let totalWeighted = 0;

    reqs.forEach(r => {
      if (r.status === 'Complete' || r.status === 'Delivered') sDelivered++;
      else if (r.status === 'Partially Delivered') sPartial++;
      else sPending++;

      const items = (r.request_items as any[]) || [];
      const rTotal = items.reduce((s, i) => s + (parseInt(i.qty) || 0), 0);
      const rDel = items.reduce((s, i) => s + (parseInt(i.received_quantity) || 0), 0);
      if (rTotal > 0) totalWeighted += (rDel / rTotal);
    });

    const completionPercent = Math.round((totalWeighted / reqs.length) * 100);
    let overall: 'Delivered' | 'Partially Delivered' | 'Pending' = 'Pending';
    if (completionPercent === 100) overall = 'Delivered';
    else if (completionPercent > 0) overall = 'Partially Delivered';

    return {
      schoolName: name,
      totalRequests: reqs.length,
      deliveredRequests: sDelivered,
      partialRequests: sPartial,
      pendingRequests: sPending,
      completionPercentage: completionPercent,
      overallStatus: overall
    };
  }).sort((a, b) => b.completionPercentage - a.completionPercentage);

  const sDist = computedSchoolStats.reduce((acc, curr) => {
    if (curr.overallStatus === 'Delivered') acc.delivered++;
    else if (curr.overallStatus === 'Partially Delivered') acc.partial++;
    else acc.pending++;
    return acc;
  }, { delivered: 0, partial: 0, pending: 0 });

  setSchoolStats(computedSchoolStats);
  setSchoolStatusDistribution({
    ...sDist,
    total: computedSchoolStats.length
  });

  setStats({
    pending,
    partiallyDelivered,
    rejected,
    completed,
    totalItems: (distributionRes.data || []).reduce((sum, item) => sum + (item.quantity || 0), 0),
    totalSchools: computedSchoolStats.length,
    totalRequests: pending + partiallyDelivered + completed + rejected,
    completionRate: overallRate
  });

      const createdActivities = (recentCreatedRes.data || []).map(req => ({
        id: `created-${req.control_no}`,
        requestId: req.control_no,
        text: `${req.school_name || 'A school'} requested an item.`,
        time: new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(req.created_at).getTime(),
        type: 'created',
        status: (req.status === 'Complete' || req.status === 'Delivered') ? 'Completed' : 
                (req.status === 'Partially Delivered') ? 'Partially' : 'Pending'
      }));

      const completedActivities = (recentCompletedRes.data || []).map(req => ({
        id: `completed-${req.control_no}`,
        requestId: req.control_no,
        text: `${req.school_name || 'A school'} marked a request as ${req.status === 'Partially Delivered' ? 'partially delivered' : 'delivered'}.`,
        time: new Date(req.delivered_at || req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date(req.delivered_at || req.created_at).getTime(),
        type: 'completed',
        status: req.status === 'Partially Delivered' ? 'Partially' : 'Completed'
      }));

      const allActivities = [...createdActivities, ...completedActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 8);

      setRecentActivities(allActivities);

      if (stocksRes.data) {
        setInventoryStocks(stocksRes.data.map(item => {
          const qty = item.total_quantity || 0;
          const critical = item.critical_level || 0;
          let status = 'Healthy';
          let color = 'text-emerald-500';
          
          if (qty <= critical) {
            status = 'Critical';
            color = 'text-red-500';
          } else if (qty <= critical * 1.5) {
            status = 'Low';
            color = 'text-amber-500';
          }

          return {
            name: item.item_name || 'Unknown Item',
            qty: `${qty} pcs`,
            status: status,
            statusColor: color
          };
        }));
      }

      if (distributionRes.data) {
        const distributionMap = distributionRes.data.reduce((acc: any, curr: any) => {
          const rawLoc = curr.location || 'Unknown';
          // Consolidate messy names: "IT Basement" vs "IT-Basement"
          const normLoc = rawLoc.toLowerCase().trim().replace(/[\s-]/g, '');
          
          if (!acc[normLoc]) {
            acc[normLoc] = {
              display: rawLoc.trim(), // Keep the first/current name as display
              count: 0
            };
          }
          
          // Prefer names with spaces/proper formatting if we find them
          if (rawLoc.includes(' ') && !acc[normLoc].display.includes(' ')) {
            acc[normLoc].display = rawLoc.trim();
          }
          
          acc[normLoc].count += (curr.quantity || 0);
          return acc;
        }, {});
        
        const distributionArray = Object.values(distributionMap)
          .map((item: any) => ({ 
            location: item.display, 
            count: item.count 
          }))
          .filter(item => item.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        
        setLocationDistribution(distributionArray);
      }

      // Process chart data
      const requests = chartRequestsRes.data || [];
      const processedChartData = interval.map(date => {
        const count = requests.filter(req => {
          const reqDate = new Date(req.created_at);
          if (timeFilter === 'months' || timeFilter === 'all') return isSameMonth(reqDate, date);
          if (timeFilter === 'years') return isSameYear(reqDate, date);
          return isSameDay(reqDate, date);
        }).length;
        return {
          name: format(date, groupingFormat),
          value: count
        };
      });

      setChartData(processedChartData);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [timeFilter]);

  const yAxisMax = useMemo(() => {
    const maxValue = Math.max(...chartData.map(d => d.value), 0);
    if (maxValue <= 100) return 100;
    if (maxValue <= 500) return 500;
    if (maxValue <= 1000) return 1000;
    return Math.ceil(maxValue / 500) * 500; // For values > 1000, use 500-unit steps
  }, [chartData]);

  const yAxisTicks = useMemo(() => {
    const step = yAxisMax / 5;
    return [0, step, step * 2, step * 3, step * 4, yAxisMax];
  }, [yAxisMax]);

  useEffect(() => {
    fetchDashboardData();

    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('dashboard-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_location_stocks' },
        () => fetchDashboardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'item_requests' },
        () => fetchDashboardData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'schools' },
        () => fetchDashboardData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const totalRequestsForPie = stats.completed + stats.partiallyDelivered + stats.pending;
  const pieData = totalRequestsForPie > 0 ? [
    { name: 'Delivered', value: Math.round((stats.completed / totalRequestsForPie) * 100) },
    { name: 'Partially Delivered', value: Math.round((stats.partiallyDelivered / totalRequestsForPie) * 100) },
    { name: 'Pending', value: Math.round((stats.pending / totalRequestsForPie) * 100) },
  ] : [
    { name: 'Delivered', value: 0 },
    { name: 'Partially Delivered', value: 0 },
    { name: 'Pending', value: 0 },
  ];
  const COLORS = ['var(--brand-accent)', '#F59E0B', '#94A3B8'];

  return (
    <div className="w-full h-full overflow-y-auto bg-brand-offwhite dark:bg-slate-950 p-3 md:p-4 font-sans transition-colors duration-300">
      {/* Top Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-2 md:mb-4 gap-6">
        <div className="flex-grow">
          <h1 className="text-xl md:text-2xl font-black mb-2" style={{ color: '#000000' }}>
            {toTitleCase('Welcome In,')} <span style={{ color: 'var(--brand-accent)' }}>{userName.split(' ')[0]}</span>
          </h1>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4">
            <div className="flex items-center gap-2" ref={filterRef}>
              <div className="relative">
                <div 
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="relative flex items-center justify-between gap-2 bg-black text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-colors cursor-pointer group text-sm min-w-[120px]"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="text-white shrink-0 w-4 h-4" />
                    <span className="font-medium">
                      {timeFilter === 'all' ? toTitleCase('Filter') :
                       timeFilter === 'this-week' ? toTitleCase('This Week') :
                       timeFilter === 'last-week' ? toTitleCase('Last Week') :
                       timeFilter === 'months' ? toTitleCase('Months') :
                       toTitleCase('Years')}
                    </span>
                  </div>
                  <ChevronDown className={`text-white transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} size={14} />
                </div>

                {isFilterOpen && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-slate-900 text-black dark:text-white rounded-lg shadow-lg z-50 overflow-hidden border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-top-1 duration-200">
                    {[
                      { value: 'all', label: 'Filter' },
                      { value: 'this-week', label: 'This Week' },
                      { value: 'last-week', label: 'Last Week' },
                      { value: 'months', label: 'Months' },
                      { value: 'years', label: 'Years' }
                    ].map((option) => (
                      <div
                        key={option.value}
                        onClick={() => {
                          setTimeFilter(option.value as any);
                          setIsFilterOpen(false);
                        }}
                        className={`px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                          timeFilter === option.value 
                            ? '' 
                            : 'hover:bg-gray-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                        style={timeFilter === option.value ? { backgroundColor: 'color-mix(in srgb, var(--brand-accent), transparent 90%)', color: 'var(--brand-accent)' } : {}}
                      >
                        {toTitleCase(option.label)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center lg:justify-end">
          <div className="flex items-center gap-6 sm:gap-12">
            <div className="text-center group transition-all duration-300 cursor-default">
              <div className="text-3xl sm:text-5xl font-black leading-none" style={{ color: 'var(--brand-accent)' }}>{stats.totalRequests}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                {toTitleCase('Total Item Request')}
              </div>
            </div>

            <div className="text-center group transition-all duration-300 cursor-default">
              <div className="text-3xl sm:text-5xl font-black leading-none" style={{ color: 'var(--brand-accent)' }}>{stats.totalSchools}</div>
              <div className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                {toTitleCase('Total Unique School Request')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-12 gap-3 md:gap-4 mb-4 md:mb-6 items-start">
        {/* Left Side: Top row of dashboard cards */}
        <div className="col-span-12 grid grid-cols-12 gap-3 md:gap-4">
          {/* Left: Aralinks Inventory Banner */}
          <div 
            className="col-span-12 lg:col-span-4 min-h-[240px] md:min-h-[320px] lg:h-[400px] rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 flex flex-col justify-end text-white shadow-lg relative overflow-hidden hover:scale-[1.02] transition-transform duration-300 cursor-default"
            style={{ 
              background: 'linear-gradient(135deg, var(--brand-accent) 0%, color-mix(in srgb, var(--brand-accent), black 10%) 50%, color-mix(in srgb, var(--brand-accent), black 25%) 100%)',
              boxShadow: '0 10px 25px -5px color-mix(in srgb, var(--brand-accent), transparent 70%)'
            }}
          >
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-white/10 rounded-full -mr-16 md:-mr-20 -mt-16 md:-mt-20 blur-3xl"></div>
            <div className="relative z-10">
              <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-none mb-1" style={{ color: '#FFFFFF' }}>{toTitleCase('Aralinks')}</h2>
              <p className="text-lg md:text-xl font-medium opacity-90">{toTitleCase('Inventory')}</p>
            </div>
          </div>

          {/* Middle: Request Status */}
          <div className="col-span-12 md:col-span-6 lg:col-span-3 min-h-[280px] md:min-h-[320px] lg:h-[400px] bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:shadow-md transition-all duration-300 cursor-default group">
            <h3 className="text-[10px] md:text-[11px] font-black text-slate-400 dark:text-slate-500 mb-6 font-poppins uppercase tracking-[0.2em]">{toTitleCase('Request Status')}</h3>
            
            <div className="space-y-1 flex-grow">
              {[
                { 
                  label: 'Pending', 
                  count: stats.pending, 
                  color: 'text-slate-400', 
                  bgColor: 'bg-slate-400', 
                  lightBg: 'bg-slate-50 dark:bg-slate-800',
                  icon: <Clock size={12} />, 
                  statusId: 'Pending' 
                },
                { 
                  label: 'Partially Delivered', 
                  count: stats.partiallyDelivered, 
                  color: 'text-orange-500', 
                  bgColor: 'bg-orange-500', 
                  lightBg: 'bg-orange-50/50 dark:bg-orange-500/5',
                  icon: <AlertCircle size={12} />, 
                  statusId: 'Partially' 
                },
                { 
                  label: 'Delivered', 
                  count: stats.completed, 
                  color: 'text-emerald-500', 
                  bgColor: 'bg-emerald-500', 
                  lightBg: 'bg-emerald-50/50 dark:bg-emerald-500/5',
                  icon: <CheckCircle2 size={12} />, 
                  statusId: 'Completed' 
                }
              ].map((row) => {
                const total = stats.pending + stats.partiallyDelivered + stats.completed;
                const percentage = total > 0 ? (row.count / total) * 100 : 0;
                
                return (
                  <div 
                    key={row.label}
                    onClick={() => onNavigate?.('requests', { status: row.statusId as any })}
                    className="group/row flex flex-col p-3 -mx-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${row.lightBg} ${row.color}`}>
                          {row.icon}
                        </div>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover/row:text-slate-900 dark:group-hover/row:text-white transition-colors">
                          {toTitleCase(row.label)}
                        </span>
                      </div>
                      <span className={`text-base font-black ${row.color}`}>
                        {row.count}
                      </span>
                    </div>
                    {/* Tiny Progress Bar */}
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${row.bgColor} transition-all duration-1000 ease-out`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Completion Rate */}
          <div className="col-span-12 md:col-span-6 lg:col-span-5 min-h-[320px] lg:h-[400px] bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col items-center hover:shadow-md transition-all duration-300 cursor-default group">
            <h3 className="text-[10px] md:text-[11px] font-black text-slate-400 dark:text-slate-500 mb-6 font-poppins w-full text-left uppercase tracking-[0.2em]">{toTitleCase('Completion Rate')}</h3>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 md:gap-10 w-full flex-grow">
              {/* Chart Container */}
              <div className="relative w-full aspect-square flex items-center justify-center max-w-[200px] md:max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      <linearGradient id="pieGradient0" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="var(--brand-accent)" />
                        <stop offset="100%" stopColor="var(--brand-accent)" stopOpacity={0.8} />
                      </linearGradient>
                      <linearGradient id="pieGradient1" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#FBCC14" />
                      </linearGradient>
                    </defs>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="70%"
                      outerRadius="95%"
                      paddingAngle={4}
                      dataKey="value"
                      startAngle={90}
                      endAngle={450}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={index === 0 ? "url(#pieGradient0)" : index === 1 ? "url(#pieGradient1)" : COLORS[index % COLORS.length]} 
                          className="transition-all duration-300 cursor-pointer outline-none"
                          style={{
                            filter: activeIndex === index ? 'brightness(1.1)' : 'none',
                            transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                            transformOrigin: '50% 50%'
                          }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white transition-all duration-300">
                    {activeIndex !== null ? `${pieData[activeIndex].value}%` : `${stats.completionRate}%`}
                  </span>
                  <span className="text-[10px] md:text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] transition-all duration-300">
                    {activeIndex !== null ? pieData[activeIndex].name : 'Overall'}
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-3.5 w-full sm:w-auto">
                {pieData.map((entry, index) => (
                  <div 
                    key={entry.name} 
                    className="flex items-center gap-3 transition-all duration-300 group/legend cursor-pointer"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseLeave={() => setActiveIndex(null)}
                  >
                    <div 
                      className={`w-2 h-2 rounded-full shrink-0 transition-all duration-300 ${activeIndex === index ? 'scale-150 ring-4 ring-slate-100 dark:ring-slate-800' : 'scale-100'}`} 
                      style={{ backgroundColor: index === 0 ? 'var(--brand-accent)' : index === 1 ? '#F59E0B' : isDarkMode ? '#334155' : '#E2E8F0' }}
                    />
                    <div className="flex flex-col">
                      <span 
                        className={`text-[10px] md:text-[11px] font-black uppercase tracking-wider transition-colors duration-300`}
                        style={{ color: activeIndex === index ? 'var(--brand-accent)' : undefined }}
                      >
                        {entry.name}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        {entry.value}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendation / Insight */}
            <div className={`mt-6 w-full p-3 rounded-2xl flex items-center gap-3 border transition-all duration-500 ${
              stats.completionRate >= 80 ? 'bg-emerald-50/50 dark:bg-emerald-500/5 border-emerald-100/50 dark:border-emerald-500/10' :
              stats.completionRate >= 50 ? 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-100/50 dark:border-amber-500/10' :
              'bg-rose-50/50 dark:bg-rose-500/5 border-rose-100/50 dark:border-rose-500/10'
            }`}>
              <div className={`p-1.5 rounded-xl shrink-0 ${
                stats.completionRate >= 80 ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600' :
                stats.completionRate >= 50 ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' :
                'bg-rose-100 dark:bg-rose-500/20 text-rose-600'
              }`}>
                {stats.completionRate >= 80 ? <CheckCircle2 size={14} /> : 
                 stats.completionRate >= 50 ? <AlertCircle size={14} /> : 
                 <XCircle size={14} />}
              </div>
              <p className={`text-[10px] font-bold leading-tight ${
                stats.completionRate >= 80 ? 'text-emerald-700 dark:text-emerald-400' :
                stats.completionRate >= 50 ? 'text-amber-700 dark:text-amber-400' :
                'text-rose-700 dark:text-rose-400'
              }`}>
                {stats.completionRate >= 80 ? '✅ Outstanding! Requests are being handled promptly.' :
                 stats.completionRate >= 50 ? '⚠️ High traffic. Some requests awaiting processing.' :
                 '🛑 Critical backlog. Team attention required immediately.'}
              </p>
            </div>
        </div>
      </div>

      {/* School Completion Rate Section */}
      <div className="col-span-12 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mt-4 md:mt-6 group/card">
        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {/* Left Panel: Statistics Sidebar */}
          <div className="w-full lg:w-[320px] bg-slate-50/50 dark:bg-slate-800/10 p-6 md:p-8 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl -ml-16 -mt-16 pointer-events-none"></div>
            
            <div className="relative z-10 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 flex items-center justify-center border border-brand-accent/20 mb-5 shadow-sm group-hover/card:scale-110 transition-transform duration-500">
                <Building2 className="text-brand-accent" size={24} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white font-poppins leading-tight tracking-tight">
                Unique School Completion Rate
              </h3>
            </div>

            <div className="space-y-3 relative z-10">
              {/* Summary Stats Cards */}
              <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group/stat hover:border-brand-accent/30 transition-colors">
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Schools</div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white">{schoolStatusDistribution.total}</div>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover/stat:bg-brand-accent/10 transition-colors">
                  <Building2 size={16} className="text-slate-400 group-hover/stat:text-brand-accent transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {[
                  { label: 'DELIVERED', val: schoolStatusDistribution.delivered, color: 'text-emerald-500', bg: 'bg-emerald-500', icon: <CheckCircle2 size={14} /> },
                  { label: 'PARTIAL', val: schoolStatusDistribution.partial, color: 'text-amber-500', bg: 'bg-amber-500', icon: <AlertCircle size={14} /> },
                  { label: 'PENDING', val: schoolStatusDistribution.pending, color: 'text-slate-400', bg: 'bg-slate-400', icon: <Clock size={14} /> }
                ].map((stat) => {
                  const pct = schoolStatusDistribution.total > 0 ? Math.round((stat.val / schoolStatusDistribution.total) * 100) : 0;
                  return (
                    <div key={stat.label} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={stat.color}>{stat.icon}</span>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</span>
                        </div>
                        <span className={`text-[10px] font-black ${stat.color}`}>{pct}%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-slate-800 dark:text-white">{stat.val}</span>
                        <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${stat.bg} transition-all duration-1000`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel: Expanded List View */}
          <div className="flex-grow p-4 md:p-6 lg:p-10 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
            {/* Table Header / Action Row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-widest">School Directory</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500">{schoolStats.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative group/search">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-brand-accent transition-colors" size={14} />
                  <input 
                    type="text" 
                    placeholder="Quick search school..." 
                    className="pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-xs focus:ring-1 focus:ring-brand-accent/50 transition-all w-[180px] md:w-[240px]"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto flex-grow -mx-4 md:-mx-0">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left">
                    <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-[35%]">School Name</th>
                    <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Requests</th>
                    <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center w-[180px]">Status Matrix</th>
                    <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right w-[200px]">Progress</th>
                    <th className="pb-3 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {schoolStats.map((school) => (
                    <tr key={school.schoolName} className="group/row hover:translate-x-1 transition-transform duration-300">
                      <td className="py-5 px-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-l-2xl border-y border-l border-slate-100/50 dark:border-slate-800/50">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-brand-accent shadow-sm font-black text-sm border border-slate-100 dark:border-slate-800 group-hover/row:border-brand-accent/30 transition-colors">
                            {school.schoolName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-slate-800 dark:text-white group-hover/row:text-brand-accent transition-colors truncate max-w-[250px]" title={school.schoolName}>
                              {toTitleCase(school.schoolName)}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">Secondary Education</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-center bg-slate-50/50 dark:bg-slate-800/40 border-y border-slate-100/50 dark:border-slate-800/50">
                        <div className="text-sm font-black text-slate-700 dark:text-slate-300">
                          {school.totalRequests}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Orders</div>
                      </td>
                      <td className="py-5 px-4 bg-slate-50/50 dark:bg-slate-800/40 border-y border-slate-100/50 dark:border-slate-800/50 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {[
                            { val: school.deliveredRequests, color: 'emerald', label: 'Delivered' },
                            { val: school.partialRequests, color: 'amber', label: 'Partial' },
                            { val: school.pendingRequests, color: 'slate', label: 'Pending' }
                          ].map((b) => (
                            <div key={b.label} className={`px-2 py-1.5 rounded-lg bg-${b.color}-50 dark:bg-${b.color}-500/10 border border-${b.color}-100 dark:border-${b.color}-500/20 flex flex-col items-center min-w-[40px]`} title={b.label}>
                              <span className={`text-[10px] font-black text-${b.color}-600 dark:text-${b.color}-400`}>{b.val}</span>
                              <span className={`text-[7px] font-black text-${b.color}-500 opacity-60 uppercase tracking-tighter`}>{b.label.charAt(0)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-5 px-4 bg-slate-50/50 dark:bg-slate-800/40 border-y border-slate-100/50 dark:border-slate-800/50">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${
                              school.overallStatus === 'Delivered' ? 'text-emerald-500' :
                              school.overallStatus === 'Partially Delivered' ? 'text-amber-500' :
                              'text-slate-400'
                            }`}>
                              {school.overallStatus}
                            </span>
                            <span className="text-xs font-black text-slate-800 dark:text-white" style={{ color: school.completionPercentage > 0 ? 'var(--brand-accent)' : undefined }}>
                              {school.completionPercentage}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-white dark:bg-slate-900 rounded-full overflow-hidden shadow-sm border border-slate-100 dark:border-slate-800">
                            <div 
                              className="h-full rounded-full transition-all duration-1000"
                              style={{ 
                                width: `${school.completionPercentage}%`,
                                backgroundColor: 'var(--brand-accent)'
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-5 px-4 text-center bg-slate-50/50 dark:bg-slate-800/40 rounded-r-2xl border-y border-r border-slate-100/50 dark:border-slate-800/50">
                        <button 
                          onClick={() => onNavigate?.('requests', { status: 'All' })}
                          className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-black text-slate-600 dark:text-slate-400 hover:text-brand-accent hover:border-brand-accent hover:shadow-sm transition-all uppercase tracking-[0.2em]"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {schoolStats.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-4 opacity-40">
                          <Building2 size={32} strokeWidth={1.5} />
                        </div>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">No school records found</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-8 pt-6 border-t border-slate-50 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest order-2 sm:order-1">
                Showing database entry <span className="text-slate-800 dark:text-white">1 - {schoolStats.length}</span> of {schoolStats.length}
              </p>
              <div className="flex items-center gap-2 order-1 sm:order-2">
                <button className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-brand-accent hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 shadow-sm">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1.5 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <button className="w-8 h-8 rounded-lg bg-brand-accent text-white text-[10px] font-black shadow-lg shadow-brand-accent/20">1</button>
                  <button className="w-8 h-8 rounded-lg bg-transparent text-slate-500 text-[10px] font-black hover:bg-white dark:hover:bg-slate-700 transition-all">2</button>
                </div>
                <button className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-brand-accent hover:bg-white dark:hover:bg-slate-700 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-600 shadow-sm">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Requests Trend & Recent Activities */}
      <div className="mt-4 md:mt-6 grid grid-cols-12 gap-3 md:gap-4">
        {/* Requests Chart Section - Wide Card */}
        <div className="col-span-12 lg:col-span-8 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md transition-all duration-300 cursor-default">
          <h3 className="text-base md:text-lg font-black text-slate-800 dark:text-white mb-4 md:mb-6 font-poppins">{toTitleCase('Requests Trend')}</h3>
          <div className="h-[250px] md:h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-accent)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--brand-accent)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke={isDarkMode ? "#334155" : "#F1F5F9"} 
                />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: isDarkMode ? '#64748b' : '#94A3B8', fontWeight: 600 }}
                  dy={10}
                />
                <YAxis 
                  domain={[0, yAxisMax]}
                  ticks={yAxisTicks}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDarkMode ? '#64748b' : '#94A3B8', fontWeight: 600 }}
                  width={50}
                />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className={`p-3 rounded-xl shadow-xl border-none ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-800'}`}>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                          <p className="text-sm font-black">
                            <span style={{ color: 'var(--brand-accent)' }}>{payload[0].value}</span> {payload[0].value === 1 ? 'request' : 'requests'}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="var(--brand-accent)" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                  animationDuration={1000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="col-span-12 lg:col-span-4 bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col hover:scale-[1.01] transition-transform duration-300 cursor-default lg:min-h-[400px]">
          <h3 className="text-xs md:text-sm font-black text-slate-800 dark:text-white mb-6 md:mb-8 font-poppins">{toTitleCase('Recent Activities')}</h3>
          <div className="space-y-4 flex-grow overflow-y-auto pr-2 max-h-[400px] lg:max-h-none">
            {recentActivities.map((activity) => (
              <div 
                key={activity.id} 
                className="flex gap-3 p-3 -m-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
                onClick={() => {
                  const status = activity.status === 'Delivered' ? 'Completed' : 
                                 activity.status === 'Partially Delivered' ? 'Partially' : 
                                 'Pending';
                  onNavigate?.('requests', { requestId: activity.requestId, status });
                }}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activity.type === 'completed' ? 'bg-emerald-500' : ''}`} style={activity.type !== 'completed' ? { backgroundColor: 'var(--brand-accent)' } : {}}></div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                    {activity.text}
                  </p>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{activity.time}</span>
                </div>
              </div>
            ))}
            {recentActivities.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-10">No recent activities</p>
            )}
          </div>
          <button 
            onClick={() => onNavigate?.('requests')}
            className="w-full mt-6 py-3 bg-black text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-800 transition-colors shrink-0"
          >
            {toTitleCase('View all activity')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Features;
