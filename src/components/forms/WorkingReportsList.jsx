import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';
import { format } from 'date-fns';

export default function WorkingReportsList() {
  const [workingReports, setWorkingReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReports = async () => {
      try {
        const reports = await base44.entities.WorkingReport.list('-updated_date', 100);
        setWorkingReports(reports || []);
      } catch (error) {
        console.error('Error loading working reports:', error);
      } finally {
        setLoading(false);
      }
    };

    loadReports();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Reports</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-slate-500 text-sm">Loading reports...</p>
        ) : workingReports.length === 0 ? (
          <p className="text-slate-500 text-sm">No working reports available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Report #</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Work Order</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Duration</th>
                  <th className="text-left py-3 px-4 font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {workingReports.map(report => (
                  <tr key={report.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-slate-900 font-medium">{report.report_number || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">{report.time_entry_id || '-'}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {report.created_date ? format(new Date(report.created_date), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={report.status === 'draft' ? 'outline' : 'default'}>
                        {report.status || 'draft'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {report.duration_minutes ? `${Math.floor(report.duration_minutes / 60)}h ${report.duration_minutes % 60}m` : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="ghost" size="sm" className="gap-1">
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}