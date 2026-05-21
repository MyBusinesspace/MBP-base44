import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function RepeatingInstructionsSection({
  formData,
  setFormData,
  isReadOnly,
  createMode
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-purple-700 mb-1.5 uppercase tracking-wide">
        Repeating Work Instructions
      </div>
      <div className="rounded-lg border border-purple-300 bg-white shadow-sm">
        <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-slate-700">
              Enable Repeating
            </label>
          </div>
          <input
            type="checkbox"
            checked={formData.is_repeating || false}
            onChange={(e) => {
              console.log('🔄 [EDIT WO] Toggling is_repeating:', e.target.checked);
              setFormData({ ...formData, is_repeating: e.target.checked });
            }}
            disabled={isReadOnly && !createMode}
            className="h-5 w-9 cursor-pointer"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundColor: formData.is_repeating ? '#0f172a' : '#cbd5e1',
              borderRadius: '9999px',
              position: 'relative',
              transition: 'background-color 0.2s'
            }}
          />
        </div>

        {formData.is_repeating && (
          <>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Recurrence Pattern
              </label>
              <Select
                value={formData.recurrence_type || 'daily'}
                onValueChange={(value) => {
                  console.log('📝 [EDIT WO] Recurrence type changed:', value);
                  setFormData({ ...formData, recurrence_type: value });
                }}
                disabled={isReadOnly && !createMode}
              >
                <SelectTrigger>
                  <SelectValue>
                    {formData.recurrence_type === 'daily' && 'Daily'}
                    {formData.recurrence_type === 'weekly' && 'Weekly'}
                    {formData.recurrence_type === 'monthly' && 'Monthly'}
                    {!formData.recurrence_type && 'Select pattern'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">
                Repeat Until
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.recurrence_end_date && "text-slate-400"
                    )}
                    disabled={isReadOnly && !createMode}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.recurrence_end_date
                      ? format(new Date(formData.recurrence_end_date), 'MMM d, yyyy')
                      : 'Pick end date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.recurrence_end_date ? new Date(formData.recurrence_end_date) : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const endOfDay = new Date(date);
                        endOfDay.setHours(23, 59, 59, 999);
                        console.log('📅 [EDIT WO] Recurrence end date set:', endOfDay.toISOString());
                        setFormData({ ...formData, recurrence_end_date: endOfDay.toISOString() });
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
              <input
                type="checkbox"
                id="skip-weekends-edit-section1"
                checked={formData.skip_weekends || false}
                onChange={(e) => {
                  console.log('☑️ [EDIT WO] Skip weekends changed:', e.target.checked);
                  setFormData({ ...formData, skip_weekends: e.target.checked });
                }}
                disabled={isReadOnly && !createMode}
                className="h-4 w-4 cursor-pointer"
              />
              <Label htmlFor="skip-weekends-edit-section1" className="text-xs font-normal cursor-pointer">
                Skip Sundays - Move to Saturday with note
              </Label>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}