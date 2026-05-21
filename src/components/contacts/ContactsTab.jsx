import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '@/components/DataProvider';
import { useDebounce } from '@/components/hooks/useDebounce';
import { Contact, ContactCategory } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Phone, Mail, MapPin, Building2, Plus, Search, Settings,
  Trash2, Eye, Filter, Users, X, Map, Building, ArrowUpDown, Columns3
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ContactDetailsPanel from '@/components/contacts/ContactDetailsPanel';
import ContactsSettingsPanel from '@/components/contacts/ContactsSettingsPanel';

export default function ContactsTab() {
  const { currentUser, currentCompany } = useData();
  const [contacts, setContacts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [visibleColumns, setVisibleColumns] = useState({
    avatar: true, name: true, company: true, description: true,
    category: true, phone: true, email: true, location: true, map: true
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactsData, categoriesData] = await Promise.all([
        Contact.list('-created_date', 1000),
        ContactCategory.list('sort_order')
      ]);
      setContacts(contactsData || []);
      setCategories(categoriesData || []);
    } catch (error) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(c =>
        c.name?.toLowerCase().includes(query) || c.company?.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) || c.phone?.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) || c.location_name?.toLowerCase().includes(query)
      );
    }
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(c => {
        if (selectedCategories.includes('uncategorized')) return !c.category_id || selectedCategories.includes(c.category_id);
        return c.category_id && selectedCategories.includes(c.category_id);
      });
    }
    return [...filtered].sort((a, b) => {
      let aVal = (a[sortField] || '').toString().toLowerCase();
      let bVal = (b[sortField] || '').toString().toLowerCase();
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [contacts, debouncedSearchQuery, selectedCategories, sortField, sortDirection]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    contacts.forEach(c => {
      const id = c.category_id || 'uncategorized';
      counts[id] = (counts[id] || 0) + 1;
    });
    return counts;
  }, [contacts]);

  const handleBulkDelete = async () => {
    if (!selectedContacts.size) return;
    if (!confirm(`Delete ${selectedContacts.size} contact(s)?`)) return;
    await Promise.allSettled(Array.from(selectedContacts).map(id => Contact.delete(id)));
    toast.success('Contacts deleted');
    setSelectedContacts(new Set());
    setIsMultiSelectMode(false);
    await loadData();
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              Filter
              {selectedCategories.length > 0 && <Badge variant="secondary">{selectedCategories.length}</Badge>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Filter by Category</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={selectedCategories.includes('uncategorized')}
              onCheckedChange={() => setSelectedCategories(prev => prev.includes('uncategorized') ? prev.filter(x => x !== 'uncategorized') : [...prev, 'uncategorized'])}
            >
              Uncategorized <Badge variant="secondary" className="ml-auto">{categoryCounts['uncategorized'] || 0}</Badge>
            </DropdownMenuCheckboxItem>
            {categories.map(cat => (
              <DropdownMenuCheckboxItem
                key={cat.id}
                checked={selectedCategories.includes(cat.id)}
                onCheckedChange={() => setSelectedCategories(prev => prev.includes(cat.id) ? prev.filter(x => x !== cat.id) : [...prev, cat.id])}
              >
                {cat.name} <Badge variant="secondary" className="ml-auto">{categoryCounts[cat.id] || 0}</Badge>
              </DropdownMenuCheckboxItem>
            ))}
            {selectedCategories.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSelectedCategories([])}><X className="w-4 h-4 mr-2" />Clear filters</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search contacts..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          {searchQuery && <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}><X className="w-4 h-4" /></Button>}
        </div>

        {currentUser?.role === 'admin' && (
          <Button variant="outline" size="sm" onClick={() => setIsMultiSelectMode(m => !m)} className={cn(isMultiSelectMode && 'bg-violet-50 border-violet-300')}>
            <Eye className="w-4 h-4 mr-2" />Select
          </Button>
        )}

        {isMultiSelectMode && selectedContacts.size > 0 && (
          <>
            <Badge variant="secondary">{selectedContacts.size} selected</Badge>
            <Button variant="outline" size="sm" onClick={handleBulkDelete} className="text-red-700 border-red-200 hover:bg-red-50">
              <Trash2 className="w-4 h-4 mr-2" />Delete
            </Button>
          </>
        )}

        {currentUser?.role === 'admin' && (
          <Button variant="outline" size="sm" onClick={() => setShowSettingsPanel(true)}>
            <Settings className="w-4 h-4 mr-2" />Settings
          </Button>
        )}

        <div className="ml-auto">
          <Button onClick={() => setSelectedContact({})} className="bg-green-600 hover:bg-green-700">
            <Plus className="w-4 h-4 mr-2" />New Contact
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
          <span className="text-sm text-slate-600">{filteredContacts.length} contacts</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm"><Columns3 className="w-4 h-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Show Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.keys(visibleColumns).map(col => (
                <DropdownMenuCheckboxItem key={col} checked={visibleColumns[col]} onCheckedChange={v => setVisibleColumns(p => ({ ...p, [col]: v }))}>
                  {col.charAt(0).toUpperCase() + col.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                {isMultiSelectMode && <TableHead className="w-10"><Checkbox checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0} onCheckedChange={() => setSelectedContacts(selectedContacts.size === filteredContacts.length ? new Set() : new Set(filteredContacts.map(c => c.id)))} /></TableHead>}
                {visibleColumns.avatar && <TableHead className="w-14"></TableHead>}
                {visibleColumns.name && <TableHead><button className="flex items-center gap-1 hover:text-indigo-600" onClick={() => handleSort('name')}>Name <ArrowUpDown className="w-3 h-3" /></button></TableHead>}
                {visibleColumns.company && <TableHead><button className="flex items-center gap-1 hover:text-indigo-600" onClick={() => handleSort('company')}>Company <ArrowUpDown className="w-3 h-3" /></button></TableHead>}
                {visibleColumns.description && <TableHead>Description</TableHead>}
                {visibleColumns.category && <TableHead>Category</TableHead>}
                {visibleColumns.phone && <TableHead><button className="flex items-center gap-1 hover:text-indigo-600" onClick={() => handleSort('phone')}>Phone <ArrowUpDown className="w-3 h-3" /></button></TableHead>}
                {visibleColumns.email && <TableHead><button className="flex items-center gap-1 hover:text-indigo-600" onClick={() => handleSort('email')}>Email <ArrowUpDown className="w-3 h-3" /></button></TableHead>}
                {visibleColumns.location && <TableHead>Location</TableHead>}
                {visibleColumns.map && <TableHead className="w-14"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-10">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="w-10 h-10 text-slate-300" />
                      <p className="text-slate-500 text-sm">No contacts found</p>
                      <Button variant="outline" size="sm" onClick={() => setSelectedContact({})}><Plus className="w-4 h-4 mr-2" />Add contact</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredContacts.map(contact => {
                const category = categories.find(c => c.id === contact.category_id);
                return (
                  <TableRow key={contact.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => !isMultiSelectMode && setSelectedContact(contact)}>
                    {isMultiSelectMode && <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedContacts.has(contact.id)} onCheckedChange={() => setSelectedContacts(prev => { const s = new Set(prev); s.has(contact.id) ? s.delete(contact.id) : s.add(contact.id); return s; })} /></TableCell>}
                    {visibleColumns.avatar && (
                      <TableCell>
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-200 flex items-center justify-center">
                          {contact.avatar_url ? <img src={contact.avatar_url} alt={contact.name} className="w-full h-full object-cover" /> : <span className="text-xs font-semibold text-slate-600">{contact.name?.charAt(0)?.toUpperCase() || '?'}</span>}
                        </div>
                      </TableCell>
                    )}
                    {visibleColumns.name && <TableCell><div className="font-medium text-slate-900 text-sm">{contact.name}</div>{contact.job_title && <div className="text-xs text-slate-500">{contact.job_title}</div>}</TableCell>}
                    {visibleColumns.company && <TableCell>{contact.company && <div className="flex items-center gap-1 text-sm text-slate-700"><Building2 className="w-3 h-3 text-slate-400" />{contact.company}</div>}</TableCell>}
                    {visibleColumns.description && <TableCell><p className="text-xs text-slate-600 line-clamp-2 max-w-[200px]">{contact.description || '-'}</p></TableCell>}
                    {visibleColumns.category && <TableCell>{category && <Badge variant="secondary" className="text-xs">{category.name}</Badge>}</TableCell>}
                    {visibleColumns.phone && <TableCell>{contact.phone && <a href={`tel:${contact.phone}`} className="flex items-center gap-1 text-sm text-slate-700 hover:text-indigo-600" onClick={e => e.stopPropagation()}><Phone className="w-3 h-3 text-slate-400" />{contact.phone}</a>}</TableCell>}
                    {visibleColumns.email && <TableCell>{contact.email && <a href={`mailto:${contact.email}`} className="flex items-center gap-1 text-sm text-slate-700 hover:text-indigo-600" onClick={e => e.stopPropagation()}><Mail className="w-3 h-3 text-slate-400" /><span className="truncate max-w-[150px]">{contact.email}</span></a>}</TableCell>}
                    {visibleColumns.location && <TableCell>{contact.location_name && <div className="flex items-center gap-1 text-sm text-slate-600"><MapPin className="w-3 h-3 text-slate-400" />{contact.location_name}</div>}</TableCell>}
                    {visibleColumns.map && <TableCell>{contact.latitude && contact.longitude && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); window.open(`https://www.google.com/maps?q=${contact.latitude},${contact.longitude}`, '_blank'); }}><Map className="w-4 h-4 text-indigo-600" /></Button>}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedContact && (
        <ContactDetailsPanel
          contact={selectedContact}
          categories={categories}
          onClose={() => setSelectedContact(null)}
          onSave={async () => { await loadData(); setSelectedContact(null); }}
          currentUser={currentUser}
        />
      )}

      <ContactsSettingsPanel
        isOpen={showSettingsPanel}
        onClose={() => setShowSettingsPanel(false)}
        onSettingsChanged={loadData}
        currentCompany={currentCompany}
      />
    </div>
  );
}