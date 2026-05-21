import React from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

export default function FavoriteContactsWidget({ maxItems = 6 }) {
  const [contacts, setContacts] = React.useState([]);

  React.useEffect(() => {
    (async () => {
      try {
        const data = await base44.entities.Contact.list('-updated_date', 200);
        setContacts(data);
      } catch { setContacts([]); }
    })();
  }, []);

  const favs = React.useMemo(() => {
    // Placeholder: top updated shared contacts as favorites
    return (contacts || []).filter(c => c.is_shared !== false).slice(0, maxItems);
  }, [contacts, maxItems]);

  return (
    <div>
      <ul className="space-y-1">
        {favs.map(c => (
          <li key={c.id} className="flex items-center justify-between text-sm">
            <span className="truncate pr-2">{c.name}</span>
            <span className="text-xs text-slate-500">{c.company || ''}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 text-right">
        <a href={createPageUrl('contacts')}>
          <Button size="sm" variant="outline">Open Contacts</Button>
        </a>
      </div>
    </div>
  );
}