import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function ChatCompactWidget({ maxItems = 6 }) {
  const [chats, setChats] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Chat.list('-lastMessageTimestamp', 200);
        setChats(data || []);
      } catch { setChats([]); }
    })();
  }, []);

  return (
    <div>
      <ul className="space-y-1">
        {(chats || []).slice(0, maxItems).map(c => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{c.name}</span>
            <span className="text-xs text-slate-500">{c.lastMessageText || '—'}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <a href={createPageUrl('chat')}>
          <Button size="sm" variant="outline">Open chat</Button>
        </a>
      </div>
    </div>
  );
}