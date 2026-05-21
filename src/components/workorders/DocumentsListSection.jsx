import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { File, Eye, Upload, Loader2, Trash2 } from 'lucide-react';
import DocumentQuickView from './DocumentQuickView';

export default function DocumentsListSection({ 
  formData, 
  handleFileUpload, 
  handleRemoveFile,
  isReadOnly,
  isUploadingFiles,
  isUploadingOtherFiles 
}) {
  const [documentQuickView, setDocumentQuickView] = useState(null);

  return (
    <>
      {/* Working Reports / Forms */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">
            📋 Working Reports / Forms
          </label>
          {!isReadOnly && (
            <div>
              <input
                type="file"
                id="file-upload-wo-reports"
                multiple
                onChange={(e) => handleFileUpload(e, 'working_reports')}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload-wo-reports').click()}
                disabled={isUploadingFiles}
                className="gap-2"
              >
                {isUploadingFiles ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Reports
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {(!formData.file_urls || formData.file_urls.length === 0) ? (
          <div className="text-center py-8 border border-slate-200 rounded-lg bg-slate-50">
            <File className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No working reports uploaded</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Document</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {formData.file_urls.map((fileUrl, index) => {
                  const fileName = fileUrl.split('/').pop() || `Report ${index + 1}`;

                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 text-sm text-slate-900 font-medium truncate max-w-xs">
                        {fileName}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDocumentQuickView({ fileUrl, fileName })}
                            className="gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(index, 'working_reports')}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Other Photos / Documents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-medium text-slate-700">
            📷 Other Photos / Documents
          </label>
          {!isReadOnly && (
            <div>
              <input
                type="file"
                id="file-upload-wo-other"
                multiple
                onChange={(e) => handleFileUpload(e, 'other')}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload-wo-other').click()}
                disabled={isUploadingOtherFiles}
                className="gap-2"
              >
                {isUploadingOtherFiles ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Photos
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {(!formData.other_file_urls || formData.other_file_urls.length === 0) ? (
          <div className="text-center py-8 border border-slate-200 rounded-lg bg-slate-50">
            <File className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No other documents uploaded</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Document</th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {formData.other_file_urls.map((fileUrl, index) => {
                  const fileName = fileUrl.split('/').pop() || `Document ${index + 1}`;

                  return (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 text-sm text-slate-900 font-medium truncate max-w-xs">
                        {fileName}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDocumentQuickView({ fileUrl, fileName })}
                            className="gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                          {!isReadOnly && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFile(index, 'other')}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Document Quick View Modal */}
      {documentQuickView && (
        <DocumentQuickView
          fileUrl={documentQuickView.fileUrl}
          fileName={documentQuickView.fileName}
          onClose={() => setDocumentQuickView(null)}
        />
      )}
    </>
  );
}