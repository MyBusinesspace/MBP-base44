import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit2, Download } from 'lucide-react';

export default function FormViewer({ form, onEdit }) {
  if (!form) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-slate-500">
          Select a form to view
        </CardContent>
      </Card>
    );
  }

  const { header_config = {}, fields = [], footer_config = {} } = form;

  return (
    <div className="space-y-4">
      <Card className="bg-white">
        {/* Header */}
        {header_config.show_logo || header_config.show_company_info ? (
          <div 
            className="p-6 text-white"
            style={{ backgroundColor: header_config.header_color || '#1e293b' }}
          >
            <div className="flex items-start justify-between">
              <div>
                {header_config.logo_url && (
                  <img src={header_config.logo_url} alt="Logo" className="h-12 mb-2" />
                )}
                <h1 className="text-2xl font-bold">{form.title}</h1>
                {header_config.custom_header_text && (
                  <p className="text-sm opacity-90 mt-1">{header_config.custom_header_text}</p>
                )}
              </div>
              <div className="text-right text-sm opacity-90">
                {header_config.company_name && <div>{header_config.company_name}</div>}
                {header_config.company_email && <div>{header_config.company_email}</div>}
                {header_config.company_phone && <div>{header_config.company_phone}</div>}
              </div>
            </div>
          </div>
        ) : null}

        {/* Fields */}
        <CardContent className="p-6">
          <div className="space-y-4">
            {fields.length === 0 ? (
              <p className="text-slate-500 text-sm">No fields in this form</p>
            ) : (
              fields.map(field => (
                <div key={field.id} className="space-y-1">
                  <label className="font-medium text-sm text-slate-900">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 text-sm text-slate-600">
                    {field.type === 'textarea' ? 'Text Area' : field.type === 'select' ? `Select: ${field.options?.join(', ')}` : field.type === 'signature' ? 'Signature Line' : `[${field.type.toUpperCase()}]`}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {footer_config.show_footer && (
            <div className="mt-8 pt-8 border-t border-slate-200 text-xs text-slate-600 text-center">
              {footer_config.footer_text && <p>{footer_config.footer_text}</p>}
              {footer_config.show_page_numbers && <p className="mt-2">Page 1</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 justify-end">
        <Button onClick={onEdit} className="gap-2">
          <Edit2 className="w-4 h-4" />
          Edit Form
        </Button>
        <Button variant="outline" className="gap-2">
          <Download className="w-4 h-4" />
          Download PDF
        </Button>
      </div>
    </div>
  );
}