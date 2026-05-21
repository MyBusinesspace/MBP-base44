import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

export default Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Get Access Token
        let accessToken;
        try {
            accessToken = await base44.asServiceRole.connectors.getAccessToken("googlecalendar");
        } catch (e) {
            return Response.json({ connected: false, error: "Not connected" }, { status: 200 });
        }

        if (!accessToken) {
             return Response.json({ connected: false }, { status: 200 });
        }

        // 2. Fetch all calendars to get all events (not just primary)
        const calendarResponse = await fetch(
            'https://www.googleapis.com/calendar/v3/users/me/calendarList',
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );

        if (!calendarResponse.ok) {
            if (calendarResponse.status === 401) {
                return Response.json({ connected: false, error: "Token expired" }, { status: 200 });
            }
        }

        const calendarData = await calendarResponse.json();
        const calendarIds = (calendarData.items || []).map(cal => cal.id);

        // 3. Fetch events from all calendars
        const now = new Date();
        const start = new Date(now.getFullYear() - 1, 0, 1).toISOString();
        const end = new Date(now.getFullYear() + 1, 11, 31).toISOString();

        const allEvents = [];
        
        for (const calendarId of calendarIds) {
            try {
                const response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=2500&showDeleted=false`, 
                    {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`
                        }
                    }
                );

                if (!response.ok) {
                    if (response.status === 401) {
                        return Response.json({ connected: false, error: "Token expired" }, { status: 200 });
                    }
                    continue;
                }

                const data = await response.json();
                allEvents.push(...(data.items || []));
            } catch (e) {
                console.error(`Error fetching calendar ${calendarId}:`, e);
                continue;
            }
        }

        // 4. Transform events
        const events = allEvents
            .map(item => ({
                id: `g_${item.id}`,
                title: item.summary || '(No Title)',
                description: item.description || '',
                start_time: item.start.dateTime || (item.start.date ? new Date(item.start.date).toISOString() : null),
                end_time: item.end.dateTime || (item.end.date ? new Date(item.end.date).toISOString() : null),
                location: item.location || '',
                event_type: 'Google', 
                all_day: !item.start.dateTime,
                is_google_event: true,
                htmlLink: item.htmlLink,
                status: item.status
            }))
            .filter(e => e.start_time && e.end_time && e.status !== 'cancelled')
            .filter((e, idx, arr) => arr.findIndex(x => x.id === e.id) === idx); // Remove duplicates

        return Response.json({ connected: true, events, totalEvents: events.length });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});