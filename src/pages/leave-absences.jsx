import React, { useEffect, useState, useCallback } from 'react';
import { useData } from '@/components/DataProvider';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Settings, CalendarDays } from 'lucide-react';
import LeaveAbsencesView from '@/components/payrolls/LeaveAbsencesView';
import { cn } from '@/lib/utils';

export default function LeaveAbsencesPage() {
  const { currentUser, loadUsers, currentCompany } = useData();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const list = await loadUsers();
      setUsers(list || []);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [loadUsers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {/* Header */}
      <Card className="mb-6 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {currentCompany?.leave_absences_tab_icon_url ? (
              <img src={currentCompany.leave_absences_tab_icon_url} alt="Leave & Absences" className="w-10 h-10 object-contain" />
            ) : (
              <div className="p-2 bg-green-100 rounded-lg">
                <CalendarDays className="w-5 h-5 text-green-600" />
              </div>
            )}
            <h1 className="text-xl font-bold text-slate-900">Leave & Absences</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {}}
            className={cn("")}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </Card>

      {/* Table (same component as before) */}
      <LeaveAbsencesView
        users={users}
        currentUser={currentUser}
        onRefresh={loadData}
      />
    </div>
  );
}