import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function FormHeaderSettings({ form, onSave }) {
  const [config, setConfig] = useState(form?.header_config || {});
  const [logoPreview, setLogoPreview] = useState(form?.header_config?.logo_url);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleLogoUpload = async (file) => {
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setLogoPreview(file_url);
      setConfig({ ...config, logo_url: file_url });
    } catch (error) {
      console.error('Error uploading logo:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.FormTemplate.update(form.id, {
        header_config: config
      });
      queryClient.invalidateQueries(['forms']);
      if (onSave) onSave();
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Logo */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-900">Logo</h3>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-3">Upload Logo</label>
          <div className="flex gap-4">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md"
            />
            {logoPreview && (
              <img src={logoPreview} alt="Preview" className="h-12 object-contain" />
            )}
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.show_logo}
            onChange={(e) => setConfig({ ...config, show_logo: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Show logo on forms</span>
        </label>
      </div>

      {/* Company Info */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-900">Company Information</h3>
        
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Company Name</label>
          <Input
            value={config.company_name || ''}
            onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
            placeholder="Your company name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Address</label>
          <Input
            value={config.company_address || ''}
            onChange={(e) => setConfig({ ...config, company_address: e.target.value })}
            placeholder="Full address"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
            <Input
              value={config.company_phone || ''}
              onChange={(e) => setConfig({ ...config, company_phone: e.target.value })}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
            <Input
              value={config.company_email || ''}
              onChange={(e) => setConfig({ ...config, company_email: e.target.value })}
              placeholder="info@company.com"
            />
          </div>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.show_company_info}
            onChange={(e) => setConfig({ ...config, show_company_info: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Show company info on forms</span>
        </label>
      </div>

      {/* Header Styling */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-900">Header Styling</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Header Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.header_color || '#1e40af'}
                onChange={(e) => setConfig({ ...config, header_color: e.target.value })}
                className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
              />
              <Input
                value={config.header_color || '#1e40af'}
                onChange={(e) => setConfig({ ...config, header_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Text Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={config.header_text_color || '#ffffff'}
                onChange={(e) => setConfig({ ...config, header_text_color: e.target.value })}
                className="w-12 h-10 border border-slate-300 rounded cursor-pointer"
              />
              <Input
                value={config.header_text_color || '#ffffff'}
                onChange={(e) => setConfig({ ...config, header_text_color: e.target.value })}
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Custom Header Text</label>
          <Input
            value={config.custom_header_text || ''}
            onChange={(e) => setConfig({ ...config, custom_header_text: e.target.value })}
            placeholder="e.g., Department of Human Resources"
          />
        </div>
      </div>

      {/* Footer Settings */}
      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-4">
        <h3 className="font-bold text-slate-900">Footer</h3>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.show_footer}
            onChange={(e) => setConfig({ ...config, show_footer: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Show footer</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Footer Text</label>
          <Textarea
            value={config.footer_text || ''}
            onChange={(e) => setConfig({ ...config, footer_text: e.target.value })}
            placeholder="Footer text that appears on all pages"
            rows="2"
          />
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.show_page_numbers}
            onChange={(e) => setConfig({ ...config, show_page_numbers: e.target.checked })}
            className="w-4 h-4"
          />
          <span className="text-sm text-slate-700">Show page numbers</span>
        </label>
      </div>

      {/* Save Button */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Settings'
        )}
      </Button>
    </div>
  );
}