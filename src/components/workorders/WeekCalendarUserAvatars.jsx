import React from 'react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';

/**
 * Renders team badges + user avatars (with per-worker clock-in/out times) for a work order card.
 */
export default function WeekCalendarUserAvatars({
  entry,
  day,
  activeUsers,
  assignedTeams,
  safeUsers,
  explicitUserIds,
  isReadOnly,
  viewMode,
  viewBy,
  entity,
  assigneeSearch,
  setAssigneeSearch,
  toggleAssignUser,
  woUserTimeMap,
}) {
  const tsz = viewMode === '3days' ? "text-[9px]" : "text-[6px]";

  const avatarWrapClass = viewMode === 'week' ? "scale-75 origin-center" : "";

  // Shared user search popover content
  const UserSearchPopover = ({ excludeAssigned }) => (
    <PopoverContent className="z-[10050] w-64 p-2 shadow-xl"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Input
        placeholder="Search users..."
        value={assigneeSearch}
        onChange={(e) => setAssigneeSearch(e.target.value)}
        className="h-7 text-xs mb-1"
      />
      <div className="max-h-56 overflow-auto">
        {safeUsers
          .filter(u => !u.archived && (!excludeAssigned || !explicitUserIds.has(u.id)))
          .filter(u => {
            const name = (u.nickname || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || '').toLowerCase();
            return name.includes(assigneeSearch.toLowerCase());
          })
          .slice(0, 30)
          .map(u => (
            <div
              key={u.id}
              className="px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded flex items-center gap-2"
              onClick={(ev) => { setAssigneeSearch(''); toggleAssignUser(ev, entry, u.id); }}
            >
              <Avatar user={u} size="xs" />
              <span className="text-xs">{u.nickname || u.first_name || u.email}</span>
            </div>
          ))}
        {excludeAssigned && safeUsers.filter(u => !u.archived && !explicitUserIds.has(u.id)).length === 0 && (
          <div className="text-[11px] text-slate-500 px-2 py-1">All users assigned</div>
        )}
      </div>
    </PopoverContent>
  );

  const timeSz = viewMode === '3days' ? "text-[8px]" : "text-[7px]";

  // Max avatars that fit before showing "+X"
  const MAX_VISIBLE = 4;
  const visibleUsers = activeUsers.slice(0, MAX_VISIBLE);
  const hiddenCount = activeUsers.length - MAX_VISIBLE;

  return (
    <div className="flex flex-col gap-1 w-full">
      {/* ROW 1: Avatar + time stacked per user, in a horizontal row */}
      <div className="flex flex-row items-start gap-1 relative z-[40] pointer-events-auto flex-wrap">
        {activeUsers.length === 0 ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                onKeyDown={(ev) => ev.stopPropagation()}
                onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                title="Add user"
                disabled={isReadOnly}
                className="w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center hover:bg-slate-50 relative z-[60]"
              >
                <Plus className="w-3 h-3" />
              </button>
            </PopoverTrigger>
            <UserSearchPopover excludeAssigned={false} />
          </Popover>
        ) : (
          <>
            {visibleUsers.map((user) => {
              const timeKey = `${entry.id}::${user.id}`;
              const times = woUserTimeMap.get(timeKey);
              const dayIsFuture = day > new Date();
              const clockInTime = (!dayIsFuture && times?.clockIn) ? format(parseISO(times.clockIn), 'HH:mm') : null;
              const clockOutTime = (!dayIsFuture && times?.clockOut) ? format(parseISO(times.clockOut), 'HH:mm') : null;
              return (
                <div key={user.id} className="flex flex-col items-center gap-0.5">
                  {/* Avatar */}
                  <button
                    onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); toggleAssignUser(ev, entry, user.id); }}
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    title="Remove from this work order"
                    disabled={isReadOnly}
                    className={cn("ring-1 ring-white rounded-lg overflow-hidden focus:outline-none relative", avatarWrapClass)}
                  >
                    <Avatar user={user} size="xs" className="rounded-lg" />
                  </button>
                  {/* Times below avatar */}
                  {(clockInTime || clockOutTime) && (
                    <div className="flex flex-col items-center gap-0">
                      {clockInTime && (
                        <span className={cn("bg-blue-500 text-white px-1 py-0 rounded leading-tight font-bold", timeSz)}>{clockInTime}</span>
                      )}
                      {clockOutTime && (
                        <span className={cn("bg-red-500 text-white px-1 py-0 rounded leading-tight font-bold", timeSz)}>{clockOutTime}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* +X overflow badge */}
            {hiddenCount > 0 && (
              <div className="flex flex-col items-center justify-start pt-0.5">
                <div className="w-4 h-4 rounded bg-slate-300 border border-white flex items-center justify-center text-[6px] font-bold text-slate-700">
                  +{hiddenCount}
                </div>
              </div>
            )}

            {/* Add (+) button */}
            <div className="flex flex-col items-center justify-start pt-0.5">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                    onClickCapture={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                    onMouseDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                    onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                    onKeyDown={(ev) => ev.stopPropagation()}
                    onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); }}
                    title="Add user"
                    disabled={isReadOnly}
                    className="w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center hover:bg-slate-50 relative z-[60]"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </PopoverTrigger>
                <UserSearchPopover excludeAssigned={true} />
              </Popover>
            </div>
          </>
        )}
      </div>
    </div>
  );
}