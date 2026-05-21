import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { File, Eye, Upload, Loader2, Trash2, Pencil, Check, X, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import OrderDocumentMatrixTab from './OrderDocumentMatrixTab';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

function PreviewModal({ fileUrl, title, onClose }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(fileUrl);
  const isPDF = /\.pdf(\?|$)/i.test(fileUrl);
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-slate-800 truncate pr-4">{title}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(fileUrl, '_blank')} className="gap-1">
              <ExternalLink className="w-3 h-3" /> Open
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4 min-h-0">
          {isImage ? (
            <img src={fileUrl} alt={title} className="max-w-full h-auto mx-auto rounded" crossOrigin="anonymous" />
          ) : isPDF ? (
            <iframe src={fileUrl} className="w-full h-[70vh] border-0 rounded" title={title} />
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-slate-500">
              <File className="w-12 h-12 mb-3 text-slate-300" />
              <p className="mb-4">Preview not available for this file type</p>
              <Button variant="outline" onClick={() => window.open(fileUrl, '_blank')} className="gap-2">
                <ExternalLink className="w-4 h-4" /> Open in new tab
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocRow({ fileUrl, title, notes, uploadDate, index, isReadOnly, onPreview, onRemove, onRenameTitle, onUpdateNotes }) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNotes, setDraftNotes] = useState(notes || '');
  const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(fileUrl);

  const commitTitle = () => { onRenameTitle(index, draftTitle); setEditingTitle(false); };
  const commitNotes = () => { onUpdateNotes(index, draftNotes); setEditingNotes(false); };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 group">
      {/* Thumbnail */}
      <td className="p-2 w-14">
        <div
          className="w-10 h-10 rounded border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer overflow-hidden"
          onClick={() => onPreview(fileUrl, title)}
        >
          {isImage ? (
            <img src={fileUrl} alt="" className="w-full h-full object-cover" crossOrigin="anonymous" />
          ) : (
            <File className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </td>

      {/* Title */}
      <td className="p-2">
        {editingTitle ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draftTitle}
              onChange={e => setDraftTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
              className="flex-1 text-sm border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button onClick={commitTitle} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditingTitle(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-800 font-medium truncate max-w-[180px]">{title}</span>
            {!isReadOnly && (
              <button onClick={() => { setDraftTitle(title); setEditingTitle(true); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </td>

      {/* Notes */}
      <td className="p-2">
        {editingNotes ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={draftNotes}
              onChange={e => setDraftNotes(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitNotes(); if (e.key === 'Escape') setEditingNotes(false); }}
              placeholder="Add notes..."
              className="flex-1 text-sm border border-indigo-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 min-w-[140px]"
            />
            <button onClick={commitNotes} className="text-green-600 hover:text-green-700"><Check className="w-4 h-4" /></button>
            <button onClick={() => setEditingNotes(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-slate-500 truncate max-w-[180px]">{notes || <span className="text-slate-300 italic text-xs">—</span>}</span>
            {!isReadOnly && (
              <button onClick={() => { setDraftNotes(notes || ''); setEditingNotes(true); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </td>

      {/* Upload Date */}
      <td className="p-2 w-36">
        <span className="text-xs text-slate-500">{uploadDate || '—'}</span>
      </td>

      {/* Actions */}
      <td className="p-2 w-24">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => onPreview(fileUrl, title)} className="gap-1 h-7 px-2 text-xs">
            <Eye className="w-3 h-3" /> View
          </Button>
          {!isReadOnly && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function DocumentsTab({
  formData, setFormData, isReadOnly,
  handleRemoveFile,
  entry, handleExportPDF
}) {
  const [preview, setPreview] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isUploadingOtherFiles, setIsUploadingOtherFiles] = useState(false);

  const getTitle = (fileUrl, meta, index, prefix) => {
    if (meta?.[index]?.title) return meta[index].title;
    const raw = fileUrl.split('/').pop() || `${prefix} ${index + 1}`;
    // strip UUID prefix like "abc123_"
    return raw.replace(/^[a-f0-9]{7,}_/i, '');
  };

  const getDate = (meta, index, fallback) => {
    if (meta?.[index]?.upload_date) {
      try { return format(new Date(meta[index].upload_date), 'dd/MM/yyyy HH:mm'); } catch {}
    }
    if (fallback) {
      try { return format(new Date(fallback), 'dd/MM/yyyy'); } catch {}
    }
    return null;
  };

  const updateMeta = (field, index, key, value) => {
    setFormData(prev => {
      const arr = Array.isArray(prev[field]) ? [...prev[field]] : [];
      arr[index] = { ...(arr[index] || {}), [key]: value };
      return { ...prev, [field]: arr };
    });
  };

  const filesMeta = formData.file_urls_meta || [];
  const otherMeta = formData.other_file_urls_meta || [];

  const handleUploadWithMeta = async (e, type) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const urlsField = type === 'working_reports' ? 'file_urls' : 'other_file_urls';
    const metaField = type === 'working_reports' ? 'file_urls_meta' : 'other_file_urls_meta';
    const setUploading = type === 'working_reports' ? isUploadingFiles : isUploadingOtherFiles;
    const now = new Date().toISOString();

    if (type === 'working_reports') setIsUploadingFiles(true);
    else setIsUploadingOtherFiles(true);

    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push({ url: file_url, name: file.name });
      }

      // Atomically add both URLs and metadata
      setFormData(prev => {
        const existingUrls = prev[urlsField] || [];
        const existingMeta = Array.isArray(prev[metaField]) ? [...prev[metaField]] : [];
        const startIdx = existingUrls.length;

        const newUrls = uploadedUrls.map(f => f.url);
        uploadedUrls.forEach((f, i) => {
          existingMeta[startIdx + i] = { title: f.name, upload_date: now };
        });

        return {
          ...prev,
          [urlsField]: [...existingUrls, ...newUrls],
          [metaField]: existingMeta
        };
      });

      toast.success(`${files.length} file(s) uploaded successfully`);
    } catch (err) {
      toast.error('Failed to upload files');
    } finally {
      if (type === 'working_reports') setIsUploadingFiles(false);
      else setIsUploadingOtherFiles(false);
      e.target.value = '';
    }
  };

  return (
    <>
      {/* Tab switcher */}
      <div className="flex border-b border-slate-200 px-4 pt-2 bg-white sticky top-0 z-10">
        {['list', 'matrix'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              activeTab === tab ? 'border-green-600 text-green-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'list' ? 'List' : 'Document Matrix'}
          </button>
        ))}
      </div>

      {activeTab === 'list' && (
        <div className="p-4 space-y-5">
          {/* Working Reports */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-700">📋 Working Reports / Forms</span>
              {!isReadOnly && (
                <>
                  <input type="file" id="doc-tab-reports" multiple onChange={e => handleUploadWithMeta(e, 'working_reports')} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('doc-tab-reports').click()} disabled={isUploadingFiles} className="gap-1 h-7 text-xs">
                    {isUploadingFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isUploadingFiles ? 'Uploading...' : 'Upload'}
                  </Button>
                </>
              )}
            </div>
            {(!formData.file_urls || formData.file_urls.length === 0) ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                <File className="w-8 h-8 mx-auto mb-1 text-slate-200" />No working reports uploaded
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="p-2 w-14"></th>
                    <th className="p-2 text-left text-xs font-semibold text-slate-500">Title</th>
                    <th className="p-2 text-left text-xs font-semibold text-slate-500">Notes</th>
                    <th className="p-2 w-36 text-left text-xs font-semibold text-slate-500">Upload Date</th>
                    <th className="p-2 w-24 text-left text-xs font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.file_urls.map((url, i) => (
                    <DocRow
                      key={i}
                      fileUrl={url}
                      title={getTitle(url, filesMeta, i, 'Report')}
                      notes={filesMeta?.[i]?.notes || ''}
                      uploadDate={getDate(filesMeta, i, entry?.updated_date || entry?.created_date)}
                      index={i}
                      isReadOnly={isReadOnly}
                      onPreview={(u, t) => setPreview({ fileUrl: u, title: t })}
                      onRemove={idx => handleRemoveFile(idx, 'working_reports')}
                      onRenameTitle={(idx, val) => updateMeta('file_urls_meta', idx, 'title', val)}
                      onUpdateNotes={(idx, val) => updateMeta('file_urls_meta', idx, 'notes', val)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Other Photos / Documents */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
              <span className="text-sm font-semibold text-slate-700">📷 Other Photos / Documents</span>
              {!isReadOnly && (
                <>
                  <input type="file" id="doc-tab-other" multiple onChange={e => handleUploadWithMeta(e, 'other')} className="hidden" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('doc-tab-other').click()} disabled={isUploadingOtherFiles} className="gap-1 h-7 text-xs">
                    {isUploadingOtherFiles ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                    {isUploadingOtherFiles ? 'Uploading...' : 'Upload'}
                  </Button>
                </>
              )}
            </div>
            {(!formData.other_file_urls || formData.other_file_urls.length === 0) ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                <File className="w-8 h-8 mx-auto mb-1 text-slate-200" />No other documents uploaded
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-white border-b border-slate-100">
                    <th className="p-2 w-14"></th>
                    <th className="p-2 text-left text-xs font-semibold text-slate-500">Title</th>
                    <th className="p-2 text-left text-xs font-semibold text-slate-500">Notes</th>
                    <th className="p-2 w-36 text-left text-xs font-semibold text-slate-500">Upload Date</th>
                    <th className="p-2 w-24 text-left text-xs font-semibold text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.other_file_urls.map((url, i) => (
                    <DocRow
                      key={i}
                      fileUrl={url}
                      title={getTitle(url, otherMeta, i, 'Document')}
                      notes={otherMeta?.[i]?.notes || ''}
                      uploadDate={getDate(otherMeta, i, entry?.updated_date || entry?.created_date)}
                      index={i}
                      isReadOnly={isReadOnly}
                      onPreview={(u, t) => setPreview({ fileUrl: u, title: t })}
                      onRemove={idx => handleRemoveFile(idx, 'other')}
                      onRenameTitle={(idx, val) => updateMeta('other_file_urls_meta', idx, 'title', val)}
                      onUpdateNotes={(idx, val) => updateMeta('other_file_urls_meta', idx, 'notes', val)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'matrix' && (
        <div className="p-4">
          <OrderDocumentMatrixTab
            entry={entry}
            formData={formData}
            setFormData={setFormData}
            onViewWorkingReport={handleExportPDF}
          />
        </div>
      )}

      {preview && (
        <PreviewModal
          fileUrl={preview.fileUrl}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}