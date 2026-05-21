import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import Avatar from '../Avatar';
import TeamAvatar from '../shared/TeamAvatar';
import { cn } from '@/lib/utils';
import { GripVertical, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function TaskTeamAssignment({
  teams = [],
  users = [],
  selectedTeamIds = [],
  selectedEmployeeIds = [],
  onTeamsChange,
  onEmployeesChange,
  onBothChange, // single atomic callback: ({ teamIds, employeeIds }) => void
  disabled = false,
  taskDate = null,
  isUserAvailableForDate = () => true,
  onGlobalTeamChange // ✅ Callback para cambiar team globalmente
}) {
  // Helper: dispatch both changes atomically if possible
  const dispatchBoth = (newTeamIds, newEmployeeIds) => {
    if (onBothChange) {
      onBothChange({ teamIds: newTeamIds, employeeIds: newEmployeeIds });
    } else {
      if (onTeamsChange) onTeamsChange(newTeamIds);
      if (onEmployeesChange) onEmployeesChange(newEmployeeIds);
    }
  };
  // ✅ Sort teams by sort_order to match Team Management display
  const sortedTeams = React.useMemo(() => {
    return [...teams].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [teams]);
  const toggleTeam = (teamId) => {
    if (disabled) return;
    
    const teamUserIds = users
      .filter(u => u.team_id === teamId && isUserAvailableForDate(u.id, taskDate))
      .map(u => u.id);
    
    const anyTeamUserSelected = teamUserIds.length > 0 && teamUserIds.some(uid => selectedEmployeeIds.includes(uid));
    
    if (anyTeamUserSelected) {
      dispatchBoth(
        selectedTeamIds.filter(id => id !== teamId),
        selectedEmployeeIds.filter(id => !teamUserIds.includes(id))
      );
    } else {
      dispatchBoth(
        [...new Set([...selectedTeamIds, teamId])],
        [...new Set([...selectedEmployeeIds, ...teamUserIds])]
      );
    }
  };

  const handleDragEnd = (result) => {
    if (disabled) return;
    if (!result.destination) return;

    const sourceTeamId = result.source.droppableId;
    const destinationTeamId = result.destination.droppableId;
    const userId = result.draggableId;

    if (sourceTeamId === destinationTeamId) return;

    const newEmployeeIds = [...selectedEmployeeIds];
    if (!newEmployeeIds.includes(userId)) newEmployeeIds.push(userId);

    // Add destination team
    let newTeamIds = [...selectedTeamIds];
    if (!newTeamIds.includes(destinationTeamId)) newTeamIds.push(destinationTeamId);

    // Remove source team if no more users from it remain selected
    const sourceTeamUsersStillSelected = users
      .filter(u => u.team_id === sourceTeamId && u.id !== userId)
      .some(u => newEmployeeIds.includes(u.id));
    if (!sourceTeamUsersStillSelected) {
      newTeamIds = newTeamIds.filter(tid => tid !== sourceTeamId);
    }
    
    dispatchBoth(newTeamIds, newEmployeeIds);

    // ✅ Cambiar team globalmente en todas las tasks pendientes
    if (onGlobalTeamChange) {
      console.log('🌍 [DRAG] Changing team globally');
      onGlobalTeamChange(userId, destinationTeamId);
    }
  };

  const getTeamUsers = (teamId) => {
    // ✅ Show ALL users from the team, not just selected ones
    return users.filter(u => 
      u.team_id === teamId && 
      !u.archived &&
      isUserAvailableForDate(u.id, taskDate)
    );
  };

  const toggleUser = (userId) => {
    if (disabled) return;
    
    const isSelected = selectedEmployeeIds.includes(userId);
    const user = users.find(u => u.id === userId);
    
    console.log('👤 [TOGGLE USER]', userId, 'Currently selected:', isSelected, 'User team:', user?.team_id);
    
    if (isSelected) {
      const newEmployeeIds = selectedEmployeeIds.filter(id => id !== userId);
      let newTeamIds = selectedTeamIds;
      if (user?.team_id) {
        const teamUsers = users
          .filter(u => u.team_id === user.team_id && isUserAvailableForDate(u.id, taskDate))
          .map(u => u.id);
        const anyTeamUserStillSelected = teamUsers.some(uid => newEmployeeIds.includes(uid));
        if (!anyTeamUserStillSelected && selectedTeamIds.includes(user.team_id)) {
          newTeamIds = selectedTeamIds.filter(tid => tid !== user.team_id);
        }
      }
      dispatchBoth(newTeamIds, newEmployeeIds);
    } else {
      const newEmployeeIds = [...selectedEmployeeIds, userId];
      const newTeamIds = user?.team_id
        ? (selectedTeamIds.includes(user.team_id) ? selectedTeamIds : [...selectedTeamIds, user.team_id])
        : selectedTeamIds;
      dispatchBoth(newTeamIds, newEmployeeIds);
    }
  };

  const moveWorkerToTeam = (userId, newTeamId) => {
    if (disabled) return;
    
    const newEmployeeIds = [...selectedEmployeeIds];
    if (!newEmployeeIds.includes(userId)) newEmployeeIds.push(userId);

    let newTeamIds = [...selectedTeamIds];
    if (!newTeamIds.includes(newTeamId)) newTeamIds.push(newTeamId);

    // Find old team of this user and remove it if no other selected users remain
    const user = users.find(u => u.id === userId);
    if (user?.team_id && user.team_id !== newTeamId) {
      const oldTeamUsersStillSelected = users
        .filter(u => u.team_id === user.team_id && u.id !== userId)
        .some(u => newEmployeeIds.includes(u.id));
      if (!oldTeamUsersStillSelected) {
        newTeamIds = newTeamIds.filter(tid => tid !== user.team_id);
      }
    }
    
    dispatchBoth(newTeamIds, newEmployeeIds);

    // ✅ Cambiar team globalmente
    if (onGlobalTeamChange) {
      console.log('🌍 [MOVE WORKER] Changing team globally');
      onGlobalTeamChange(userId, newTeamId);
    }
  };

  const selectedUsers = users.filter(u => selectedEmployeeIds.includes(u.id));

  return (
    <div>
      <div className="text-[10px] font-medium text-slate-600 mb-2">
        Team Selection <span className="text-red-500">*</span>
        <span className="text-[9px] text-slate-500 ml-1">(Click team to select, drag workers between teams)</span>
      </div>
      
      {/* Selected Workers Header */}
      {selectedUsers.length > 0 && (
        <div className="mb-3 p-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="text-[9px] font-semibold text-slate-700 mb-1.5">
            Selected Workers ({selectedUsers.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedUsers.map(user => {
              const userName = user.nickname || user.first_name || user.full_name?.split(' ')[0] || user.email;
              return (
                <Badge 
                  key={user.id}
                  variant="secondary"
                  className="flex items-center gap-1.5 pr-1 bg-white border border-slate-300 hover:bg-slate-50"
                >
                  <Avatar user={user} size="xs" />
                  <span className="text-[9px] font-medium">{userName}</span>
                  {!disabled && (
                    <button
                      onClick={() => toggleUser(user.id)}
                      className="ml-1 p-0.5 hover:bg-slate-200 rounded transition-colors"
                    >
                      <X className="w-3 h-3 text-slate-500" />
                    </button>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 max-h-[220px] overflow-y-auto space-y-2">
          {sortedTeams.map(team => {
            const teamUsers = getTeamUsers(team.id);
            // ✅ Team is selected if AT LEAST ONE user is selected
            const anyTeamUserSelected = teamUsers.length > 0 && teamUsers.some(u => selectedEmployeeIds.includes(u.id));
            const isSelected = anyTeamUserSelected;
            
            return (
              <div
                key={team.id}
                className={cn(
                  "rounded-lg border-2 p-3 transition-all",
                  isSelected 
                    ? "bg-indigo-50 border-indigo-300" 
                    : "bg-white border-slate-200"
                )}
              >
                {/* Team Header */}
                <div 
                  className="flex items-center gap-2 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    // ✅ Allow clicking anywhere on the header to toggle team
                    if (!disabled && e.target.tagName !== 'INPUT' && e.target.type !== 'checkbox') {
                      toggleTeam(team.id);
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      console.log('☑️ [CHECKBOX] Clicked, checked:', e.target.checked);
                      toggleTeam(team.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={disabled}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                  />
                  <TeamAvatar team={team} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-800">{team.name}</span>
                      {/* Selected users avatars */}
                      {teamUsers.filter(u => selectedEmployeeIds.includes(u.id)).length > 0 && (
                        <div className="flex gap-1">
                          {teamUsers.filter(u => selectedEmployeeIds.includes(u.id)).map(user => (
                            <div key={user.id} className="flex-shrink-0">
                              <Avatar user={user} size="xs" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] text-slate-500">
                      {teamUsers.filter(u => selectedEmployeeIds.includes(u.id)).length}/{teamUsers.length} selected
                    </div>
                  </div>
                </div>

                {/* Droppable Workers Area */}
                <Droppable droppableId={team.id} isDropDisabled={disabled}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "min-h-[50px] rounded-md border-2 border-dashed transition-all p-2",
                        snapshot.isDraggingOver 
                          ? "border-indigo-400 bg-indigo-100" 
                          : "border-slate-200 bg-white"
                      )}
                    >
                      {teamUsers.length === 0 ? (
                        <div className="text-[9px] text-slate-400 text-center py-3">
                          {snapshot.isDraggingOver ? '📥 Drop here' : 'No workers in this team'}
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {teamUsers.map((user, index) => {
                            const userName = user.nickname || user.first_name || user.full_name?.split(' ')[0] || user.email;
                            const isUserSelected = selectedEmployeeIds.includes(user.id);
                            
                            return (
                              <Draggable
                                key={user.id}
                                draggableId={user.id}
                                index={index}
                                isDragDisabled={disabled || !isUserSelected}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={cn(
                                      "flex items-center gap-2 px-2 py-1.5 rounded-md border transition-all",
                                      isUserSelected ? "bg-white" : "bg-slate-50",
                                      snapshot.isDragging 
                                        ? "border-indigo-400 shadow-lg scale-105" 
                                        : isUserSelected 
                                        ? "border-slate-200 hover:border-slate-300 hover:shadow-sm" 
                                        : "border-slate-100"
                                    )}
                                  >
                                    {/* ✅ Checkbox to select/deselect user */}
                                    <input
                                      type="checkbox"
                                      checked={isUserSelected}
                                      onChange={() => toggleUser(user.id)}
                                      disabled={disabled}
                                      onClick={(e) => e.stopPropagation()}
                                      className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 flex-shrink-0"
                                    />
                                    
                                    {!disabled && isUserSelected && (
                                      <GripVertical className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                    )}
                                    <Avatar user={user} size="xs" />
                                    <div className="flex-1 min-w-0">
                                      <div className={cn(
                                        "text-[10px] font-medium truncate",
                                        !isUserSelected && "text-slate-400"
                                      )}>{userName}</div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}