import React from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import { base44 } from '@/api/base44Client';

const User = base44.entities.User;

function MemberChip({ u, teamId, onDragStart, onDragEnd }) {
  const name = u.nickname || u.first_name || u.email?.split('@')[0] || '?';
  return (
    <div
      draggable="true"
      title={`${name} — drag to reassign`}
      className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing select-none px-1.5 py-1 rounded hover:bg-white border-b border-slate-100 last:border-0"
      style={{ userSelect: 'none', WebkitUserDrag: 'element' }}
      onDragStart={(e) => {
        console.log('🟢 [MEMBER DRAG START]', { userId: u.id, name, teamId });
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/member-drag', JSON.stringify({ userId: u.id, fromTeamId: teamId }));
        e.dataTransfer.setData('text/plain', u.id);
        const ghost = document.createElement('div');
        ghost.textContent = name;
        ghost.style.cssText = 'position:fixed;top:-100px;left:-100px;padding:2px 6px;background:#1e293b;color:#fff;font-size:11px;border-radius:4px;white-space:nowrap;';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
        onDragStart({ userId: u.id, fromTeamId: teamId });
      }}
      onDragEnd={() => {
        console.log('🔴 [MEMBER DRAG END]', { userId: u.id, name });
        onDragEnd();
      }}
    >
      <Avatar user={u} size="xs" />
      <span className="text-[10px] text-slate-700 truncate max-w-[80px] leading-tight font-medium">{name}</span>
    </div>
  );
}

export default function TeamStickyCell({
  entity,
  viewBy,
  safeUsers,
  safeCustomers,
  draggedMember,
  setDraggedMember,
  memberDropTarget,
  setMemberDropTarget,
  onDataChanged,
  isReadOnly,
}) {
  const isTeamView = viewBy === 'team' && entity.id !== '__unassigned__';

  let entityName = '';
  let clientName = '';

  if (viewBy === 'project') {
    entityName = entity.name;
    const customer = safeCustomers?.find(c => c.id === entity.customer_id);
    clientName = customer?.name || '';
  } else if (viewBy === 'user') {
    entityName = entity.nickname || entity.first_name || entity.email;
  } else {
    entityName = entity.name;
  }

  const teamMembers = isTeamView
    ? safeUsers.filter(u => u.team_id === entity.id && !u.archived)
    : [];

  const isDropTarget = isTeamView && memberDropTarget === entity.id;

  const handleDragStart = (info) => setDraggedMember(info);
  const handleDragEnd = () => { setDraggedMember(null); setMemberDropTarget(null); };

  return (
    <td
      className={cn(
        "border-r-[3px] border-slate-500 sticky left-0 z-10 shadow-sm transition-colors",
        isDropTarget ? "bg-green-100 border-green-400" : "bg-slate-100"
      )}
      style={{ width: '140px', minWidth: '140px', maxWidth: '140px', padding: 0, position: 'relative', minHeight: '80px' }}
    >
      {isTeamView ? (
        // Use absolute positioning so top/bottom are always pinned regardless of row height
        <div
          style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            if (memberDropTarget !== entity.id) {
              setMemberDropTarget(entity.id);
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMemberDropTarget(entity.id);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setMemberDropTarget(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            let member = draggedMember;
            if (!member) {
              try {
                const raw = e.dataTransfer.getData('application/member-drag');
                if (raw) member = JSON.parse(raw);
              } catch (err) {}
            }
            setMemberDropTarget(null);
            setDraggedMember(null);
            if (member && member.fromTeamId !== entity.id) {
              User.update(member.userId, { team_id: entity.id })
                .then(() => { toast.success('Member moved to team'); if (onDataChanged) onDataChanged(); })
                .catch(() => { toast.error('Failed to move member'); });
            }
          }}
        >
          {/* TOP: members */}
          <div className="flex flex-col px-1 pt-1 pb-1 border-b-2 border-slate-300 bg-white">
            {teamMembers.map(u => (
              <MemberChip key={`t-${u.id}`} u={u} teamId={entity.id} onDragStart={handleDragStart} onDragEnd={handleDragEnd} />
            ))}
          </div>

          {/* MIDDLE: team name + avatar */}
          <div className="flex items-center justify-between gap-1 px-2 py-1.5 bg-slate-100">
            <div className="font-semibold text-xs truncate text-slate-800" title={entityName}>{entityName}</div>
            <TeamAvatar team={entity} size="xs" />
          </div>

          {/* Drop hint */}
          {isDropTarget && (
            <div className="text-[9px] text-green-700 text-center font-medium py-0.5 bg-green-100 border-t border-green-200">
              Drop to assign
            </div>
          )}
        </div>
      ) : (
        /* PROJECT / USER VIEW */
        <div className="p-1.5 flex items-center justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-xs truncate" title={entityName}>{entityName}</div>
            {viewBy === 'project' && clientName && (
              <div className="text-[10px] text-slate-500 truncate">{clientName}</div>
            )}
          </div>
          {viewBy === 'user' && <Avatar user={entity} size="xs" />}
        </div>
      )}
    </td>
  );
}