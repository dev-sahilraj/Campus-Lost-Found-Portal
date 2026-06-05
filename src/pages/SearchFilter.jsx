import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { usePagination } from '../hooks/usePagination';
import useRealtime from '../hooks/useRealtime';
import { useToast } from '../components/ui/Toast';
import { SkeletonGrid } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { Search, Filter, SlidersHorizontal, ChevronLeft, ChevronRight, Tag, MapPin, Palette, Calendar, PackageX } from 'lucide-react';

const CATEGORIES = ['all', 'Electronics', 'Accessories', 'Personal', 'Clothing', 'Books', 'Sports', 'Other'];
const PAGE_SIZE  = 9;

const ItemCard = ({ item }) => (
  <Link
    to={`/item/${item.type}/${item.id}`}
    className="item-card glass animate-fade-in"
    aria-label={`View ${item.type} item: ${item.title}`}
  >
    {item.image_url ? (
      <img src={item.image_url} alt={item.title} className="item-card-img" loading="lazy" />
    ) : (
      <div className="item-card-img item-card-img--placeholder" aria-hidden="true">
        <PackageX size={32} />
      </div>
    )}
    <div className="item-card-body">
      <div className="item-card-badges">
        <span className={`type-badge ${item.type}`}>{item.type.toUpperCase()}</span>
        {item.status === 'resolved' && <span className="resolved-badge">Resolved</span>}
      </div>
      <h3 className="item-card-title">{item.title}</h3>
      <div className="item-card-meta">
        {item.category && <span><Tag size={11} />{item.category}</span>}
        {item.color    && <span><Palette size={11} />{item.color}</span>}
        {item.location && <span><MapPin size={11} />{item.location}</span>}
      </div>
    </div>
  </Link>
);

const Pagination = ({ page, totalPages, hasPrev, hasNext, prev, next, goTo }) => {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
    // Show pages around current
    const start = Math.max(1, page - 2);
    return Math.min(start + i, totalPages);
  }).filter((p, i, arr) => arr.indexOf(p) === i);

  return (
    <nav className="pagination" role="navigation" aria-label="Pagination">
      <button onClick={prev} disabled={!hasPrev} className="pagination-btn" aria-label="Previous page">
        <ChevronLeft size={16} />
      </button>
      {pages.map(p => (
        <button key={p} onClick={() => goTo(p)}
          className={`pagination-btn ${p === page ? 'active' : ''}`}
          aria-label={`Page ${p}`} aria-current={p === page ? 'page' : undefined}>
          {p}
        </button>
      ))}
      <button onClick={next} disabled={!hasNext} className="pagination-btn" aria-label="Next page">
        <ChevronRight size={16} />
      </button>
      <span className="pagination-info">Page {page} of {totalPages}</span>
    </nav>
  );
};

const SearchFilter = () => {
  const { user } = useAuth();
  const toast    = useToast();

  const [allItems, setAllItems]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  const [rawQuery, setRawQuery]   = useState('');
  const [filters, setFilters]     = useState({
    type: 'all', category: 'all', color: '', location: '', date: '', status: 'active'
  });

  const query = useDebounce(rawQuery, 350);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [{ data: lostData, error: le }, { data: foundData, error: fe }] = await Promise.all([
        supabase.from('lost_items').select('*').order('created_at', { ascending: false }),
        supabase.from('found_items').select('*').order('created_at', { ascending: false }),
      ]);
      if (le || fe) throw le || fe;

      setAllItems([
        ...(lostData  || []).map(i => ({ ...i, type: 'lost',  date: i.date_lost  })),
        ...(foundData || []).map(i => ({ ...i, type: 'found', date: i.date_found })),
      ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) {
      setError('Failed to load items. Please try again.');
      toast.error('Failed to load items.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Live update when new items are added
  useRealtime({ table: 'lost_items',  enabled: !!user, onInsert: () => fetchItems() });
  useRealtime({ table: 'found_items', enabled: !!user, onInsert: () => fetchItems() });

  // Filtered list
  const filtered = allItems.filter(item => {
    if (filters.type !== 'all' && item.type !== filters.type)               return false;
    if (filters.category !== 'all' && item.category !== filters.category)   return false;
    if (filters.status !== 'all' && item.status !== filters.status)         return false;
    if (query && !item.title.toLowerCase().includes(query.toLowerCase()) &&
        !item.description?.toLowerCase().includes(query.toLowerCase()))     return false;
    if (filters.color && item.color &&
        !item.color.toLowerCase().includes(filters.color.toLowerCase()))    return false;
    if (filters.location && item.location &&
        !item.location.toLowerCase().includes(filters.location.toLowerCase())) return false;
    if (filters.date && item.date !== filters.date)                         return false;
    return true;
  });

  const { paged, page, totalPages, hasPrev, hasNext, prev, next, goTo, reset } = usePagination(filtered, PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => { reset(); }, [query, filters]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setRawQuery('');
    setFilters({ type: 'all', category: 'all', color: '', location: '', date: '', status: 'active' });
  };

  const hasActiveFilters = rawQuery || filters.type !== 'all' || filters.category !== 'all' ||
    filters.color || filters.location || filters.date || filters.status !== 'active';

  return (
    <div className="search-page">
      <div className="search-header">
        <h1 className="heading-2">Search &amp; Filter</h1>
        <p className="text-body">{filtered.length} item{filtered.length !== 1 ? 's' : ''} found</p>
      </div>

      {/* Filter Panel */}
      <div className="search-filters glass" role="search">
        <div className="search-bar-row">
          <div className="search-input-wrap">
            <Search size={18} className="search-icon" aria-hidden="true" />
            <input
              type="search"
              value={rawQuery}
              onChange={e => setRawQuery(e.target.value)}
              className="input-field search-input"
              placeholder="Search by title or description..."
              aria-label="Search items"
            />
          </div>
          <select name="type" value={filters.type} onChange={handleFilterChange}
            className="input-field filter-select" aria-label="Filter by type">
            <option value="all">All Types</option>
            <option value="lost">Lost</option>
            <option value="found">Found</option>
          </select>
          <select name="status" value={filters.status} onChange={handleFilterChange}
            className="input-field filter-select" aria-label="Filter by status">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="filter-row">
          <select name="category" value={filters.category} onChange={handleFilterChange}
            className="input-field" aria-label="Filter by category">
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
            ))}
          </select>
          <input type="text" name="color" value={filters.color} onChange={handleFilterChange}
            className="input-field" placeholder="Color..." aria-label="Filter by color" />
          <input type="text" name="location" value={filters.location} onChange={handleFilterChange}
            className="input-field" placeholder="Location..." aria-label="Filter by location" />
          <input type="date" name="date" value={filters.date} onChange={handleFilterChange}
            className="input-field" aria-label="Filter by date" />
          {hasActiveFilters && (
            <button onClick={clearFilters} className="btn-secondary clear-btn" aria-label="Clear all filters">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="search-error glass" role="alert">
          {error}
          <button onClick={fetchItems} className="btn-secondary ml-4">Retry</button>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <SkeletonGrid count={PAGE_SIZE} />
      ) : paged.length === 0 ? (
        <div className="glass" style={{ borderRadius: 'var(--radius-lg)' }}>
          <EmptyState
            icon={Search}
            title="No items found"
            description={hasActiveFilters
              ? "No items match your current filters. Try adjusting them."
              : "No items have been reported yet. Be the first!"}
            action={hasActiveFilters ? { label: 'Clear Filters', onClick: clearFilters } : undefined}
          />
        </div>
      ) : (
        <>
          <div className="items-grid">
            {paged.map(item => <ItemCard key={`${item.type}-${item.id}`} item={item} />)}
          </div>
          <Pagination page={page} totalPages={totalPages}
            hasPrev={hasPrev} hasNext={hasNext} prev={prev} next={next} goTo={goTo} />
        </>
      )}
    </div>
  );
};

export default SearchFilter;
