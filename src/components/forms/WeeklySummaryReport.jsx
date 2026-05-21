import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek } from 'date-fns';

export default function WeeklySummaryReport() {
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    closed: 0,
    totalHours: 0
  });

  useEffect(() => {
    const loadWeeklyData = async () => {
      try {
        const orders = await base44.entities.TimeEntry.list('-updated_date', 500);
        
        const now = new Date();
        const weekStart = startOfWeek(now);
        const weekEnd = endOfWeek(now);

        const weeklyOrders = orders.filter(order => {
          const orderDate = new Date(order.planned_start_time || order.created_date);
          return orderDate >= weekStart && orderDate <= weekEnd;
        });

        setWorkOrders(weeklyOrders);

        const openCount = weeklyOrders.filter(o => o.status === 'open').length;
        const closedCount = weeklyOrders.filter(o => o.status === 'closed').length;
        const totalHours = weeklyOrders.reduce((sum, o) => sum + (o.estimated_duration_hours || 0), 0);

        setStats({
          total: weeklyOrders.length,
          open: openCount,
          closed: closedCount,
          totalHours: totalHours.toFixed(1)
        });
      } catch (error) {
        console.error('Error loading weekly data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWeeklyData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.open}</div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.closed}</div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">{stats.totalHours}</div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Orders This Week</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-slate-500 text-sm">Loading...</p>
          ) : workOrders.length === 0 ? (
            <p className="text-slate-500 text-sm">No orders this week</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Date</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map(order => (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-slate-900 font-medium">{order.title || 'Untitled'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={order.status === 'open' ? 'default' : 'secondary'}>
                          {order.status === 'open' ? 'Open' : 'Closed'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {format(new Date(order.planned_start_time || order.created_date), 'MMM d')}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{order.estimated_duration_hours || 0}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}