import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tags, ListChecks, ImageIcon, Upload, Pencil, X, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import CategoryManagerDialog from './CategoryManagerDialog';
import { useData } from '../DataProvider';
import { Branch } from '@/entities/all';
import { base44 } from '@/api/base44Client';
import ImageCropDialog from '../users/ImageCropDialog';

const statusConfig = {
  active:   { label: 'Active',    bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  on_hold:  { label: 'On Hold',   bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  closed:   { label: 'Closed',    bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  archived: { label: 'Archived',  bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-300' },
};

export default function ProjectSettingsPanel({ isOpen, onClose, onSettingsChanged }) {
  const { currentCompany, setCurrentCompany } = useData();
  const [activeTab, setActiveTab] = useState('categories');
  
  // Tab icons state
  const [projectsTabIconUrl, setProjectsTabIconUrl] = useState(currentCompany?.projects_tab_icon_url || '');
  const [uploadingProjectsIcon, setUploadingProjectsIcon] = useState(false);
  
  // Image crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');

  // Status tab state
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [statusSearch, setStatusSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (isOpen) {
      setProjectsTabIconUrl(currentCompany?.projects_tab_icon_url || '');
    }
  }, [isOpen, currentCompany]);

  useEffect(() => {
    if (isOpen && activeTab === 'status') {
      loadProjects();
    }
  }, [isOpen, activeTab]);

  const loadProjects = async () => {
    setLoadingProjects(true);
    try {
      const list = await base44.entities.Project.list('-updated_date', 500);
      setProjects(Array.isArray(list) ? list : []);
    } catch (e) {
      toast.error('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleStatusChange = async (projectId, newStatus) => {
    setSavingId(projectId);
    try {
      await base44.entities.Project.update(projectId, { status: newStatus });
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p));
      toast.success('Status updated');
      if (onSettingsChanged) onSettingsChanged();
    } catch (e) {
      toast.error('Failed to update status');
    } finally {
      setSavingId(null);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchSearch = !statusSearch || (p.name || '').toLowerCase().includes(statusSearch.toLowerCase());
    const matchFilter = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchFilter;
  });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0 overflow-hidden flex flex-col">
        <SheetHeader className="px-6 py-4 bg-indigo-600 text-white border-b">
          <SheetTitle className="text-white">Project Settings</SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start border-b rounded-none px-6 bg-white">
            <TabsTrigger value="categories" className="gap-2">
              <Tags className="w-4 h-4" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="status" className="gap-2">
              <ListChecks className="w-4 h-4" />
              Status
            </TabsTrigger>
            <TabsTrigger value="tab-icons" className="gap-2">
              <ImageIcon className="w-4 h-4" />
              Tab Icons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="flex-1 overflow-y-auto mt-0 p-0">
            <CategoryManagerDialog 
              embedded={true}
              onCategoriesChanged={onSettingsChanged}
            />
          </TabsContent>

          <TabsContent value="status" className="flex-1 overflow-y-auto mt-0 px-6 py-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700">Change Project Status</h3>
                <Button variant="outline" size="sm" onClick={loadProjects} disabled={loadingProjects}>
                  {loadingProjects ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Refresh'}
                </Button>
              </div>

              {/* Filters */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input
                    placeholder="Search projects..."
                    value={statusSearch}
                    onChange={e => setStatusSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 w-32 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {loadingProjects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                </div>
              ) : filteredProjects.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No projects found</p>
              ) : (
                <div className="space-y-2">
                  {filteredProjects.map(project => {
                    const cfg = statusConfig[project.status] || statusConfig.active;
                    return (
                      <div key={project.id} className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-slate-50 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{project.name}</p>
                          {project.project_number && (
                            <p className="text-[11px] text-slate-400 font-mono">{project.project_number}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-[10px] ${cfg.bg} ${cfg.text} border ${cfg.border} font-medium`}>
                            {cfg.label}
                          </Badge>
                          <Select
                            value={project.status || 'active'}
                            onValueChange={(val) => handleStatusChange(project.id, val)}
                            disabled={savingId === project.id}
                          >
                            <SelectTrigger className="h-7 w-28 text-xs">
                              {savingId === project.id
                                ? <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                                : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="on_hold">On Hold</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                              <SelectItem value="archived">Archived</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tab-icons" className="flex-1 overflow-y-auto mt-0 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-slate-800 mb-1">Tab Icons</h3>
                <p className="text-xs text-slate-500 mb-4">Customize the icon shown on the "Projects" tab.</p>
              </div>

              {/* Projects Tab Icon */}
              <div className="p-4 border rounded-lg bg-slate-50">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${projectsTabIconUrl ? '' : 'bg-indigo-100'}`}>
                    {projectsTabIconUrl ? (
                      <img src={projectsTabIconUrl} alt="Projects icon" className="w-10 h-10 object-contain" />
                    ) : (
                      <img src="https://cdn-icons-png.flaticon.com/512/9455/9455779.png" alt="Projects default" className="w-10 h-10 object-contain" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm text-slate-800">Projects Tab Icon</h4>
                    <p className="text-xs text-slate-500">Default: Construction crane icon</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        setCropImageSrc(reader.result);
                        setCropDialogOpen(true);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                    id="projects-tab-icon-upload"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    disabled={uploadingProjectsIcon}
                    onClick={() => document.getElementById('projects-tab-icon-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingProjectsIcon ? 'Uploading...' : 'Upload Icon'}
                  </Button>
                  {projectsTabIconUrl && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCropImageSrc(projectsTabIconUrl);
                          setCropDialogOpen(true);
                        }}
                      >
                        <Pencil className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          if (!currentCompany?.id) return;
                          try {
                            await Branch.update(currentCompany.id, { projects_tab_icon_url: null });
                            const updatedCompany = { ...currentCompany, projects_tab_icon_url: null };
                            setProjectsTabIconUrl('');
                            if (setCurrentCompany) {
                              setCurrentCompany(updatedCompany);
                              localStorage.setItem('currentCompany', JSON.stringify(updatedCompany));
                            }
                            toast.success('Icon reset to default');
                            if (onSettingsChanged) onSettingsChanged();
                          } catch (error) {
                            toast.error('Failed to reset icon');
                          }
                        }}
                        className="text-red-600 hover:bg-red-50"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Reset
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Image Crop Dialog */}
        <ImageCropDialog
          isOpen={cropDialogOpen}
          onClose={() => {
            setCropDialogOpen(false);
            setCropImageSrc('');
          }}
          imageUrl={cropImageSrc}
          onSave={async (croppedBlob) => {
            if (!currentCompany?.id) return;
            
            setUploadingProjectsIcon(true);
            
            try {
              const file = new File([croppedBlob], 'projects-tab-icon.png', { type: 'image/png' });
              const result = await base44.integrations.Core.UploadFile({ file });
              
              await Branch.update(currentCompany.id, { projects_tab_icon_url: result.file_url });
              
              const updatedCompany = { ...currentCompany, projects_tab_icon_url: result.file_url };
              setProjectsTabIconUrl(result.file_url);
              if (setCurrentCompany) {
                setCurrentCompany(updatedCompany);
                // Force localStorage update to persist across components
                localStorage.setItem('currentCompany', JSON.stringify(updatedCompany));
              }
              
              toast.success('Icon updated!');
              if (onSettingsChanged) onSettingsChanged();
            } catch (error) {
              console.error('Error saving icon:', error);
              toast.error('Failed to save icon');
            } finally {
              setUploadingProjectsIcon(false);
              setCropDialogOpen(false);
              setCropImageSrc('');
            }
          }}
        />
      </SheetContent>
    </Sheet>
  );
}