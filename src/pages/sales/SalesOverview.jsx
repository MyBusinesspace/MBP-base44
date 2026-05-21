import React from 'react';
import { BarChart3, TrendingUp, DollarSign, FileText } from 'lucide-react';

export default function SalesOverview() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sales Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Monitor your sales performance and key metrics</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Revenue', value: 'AED 0', icon: DollarSign, color: 'bg-green-100 text-green-600' },
          { label: 'Quotes Sent', value: '0', icon: FileText, color: 'bg-blue-100 text-blue-600' },
          { label: 'Invoices Issued', value: '0', icon: FileText, color: 'bg-purple-100 text-purple-600' },
          { label: 'Growth', value: '0%', icon: TrendingUp, color: 'bg-orange-100 text-orange-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-xl font-bold text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
        <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
        <h3 className="text-lg font-semibold text-slate-700">Sales analytics coming soon</h3>
        <p className="text-slate-400 text-sm mt-1">Charts and reports will appear here once data is available.</p>
      </div>
    </div>
  );
}