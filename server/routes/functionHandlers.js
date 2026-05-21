import { env, requireEnv } from '../config/env.js';
import { getNextCounter } from '../utils/counters.js';

/** Matches Base44 response shape: pages often read `response.data.*` */
export function withData(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...payload, data: payload.data ?? payload };
  }
  return { data: payload };
}

export const functionHandlers = {
  getGoogleMapsKey: async () => {
    const key = env.googlePlacesApiKey;
    if (!key) {
      return { error: 'API key not configured', success: false };
    }
    return { key, apiKey: key, success: true };
  },

  forwardGeocode: async (body) => {
    const address = body?.address;
    if (!address) return { error: 'Missing address', success: false };

    const apiKey = requireEnv('GOOGLE_PLACES_API_KEY', env.googlePlacesApiKey);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results?.length) {
      const loc = data.results[0].geometry.location;
      return {
        lat: loc.lat,
        lon: loc.lng,
        latitude: loc.lat,
        longitude: loc.lng,
        success: true,
      };
    }
    return { error: `Geocoding failed: ${data.status}`, success: false };
  },

  reverseGeocode: async (body) => {
    const lat = body?.lat ?? body?.latitude;
    const lon = body?.lon ?? body?.longitude ?? body?.lng;
    if (lat == null || lon == null) {
      return { error: 'Missing lat or lon', success: false };
    }

    const apiKey = requireEnv('GOOGLE_PLACES_API_KEY', env.googlePlacesApiKey);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.results?.length) {
      return { address: data.results[0].formatted_address, success: true };
    }
    return { address: `${lat}, ${lon}`, success: false, error: data.status };
  },

  createDailyRoom: async (body) => {
    const chatId = body?.chatId;
    if (!chatId) return { error: 'Chat ID is required', success: false };

    const apiKey = requireEnv('DAILY_API_KEY', env.dailyApiKey);
    const roomType = body?.roomType || 'video';
    const roomName = `chat-${chatId}-${Date.now()}`;

    const dailyResponse = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        name: roomName,
        privacy: 'public',
        properties: {
          enable_screenshare: true,
          enable_chat: true,
          enable_knocking: false,
          enable_prejoin_ui: false,
          start_video_off: roomType === 'audio',
          start_audio_off: false,
          max_participants: 50,
          exp: Math.floor(Date.now() / 1000) + 86400,
          eject_at_room_exp: true,
        },
      }),
    });

    if (!dailyResponse.ok) {
      const errText = await dailyResponse.text();
      console.error('[createDailyRoom]', errText);
      return { error: 'Failed to create video room', success: false };
    }

    const roomData = await dailyResponse.json();
    return {
      success: true,
      room: {
        url: roomData.url,
        name: roomData.name,
        type: roomType,
      },
    };
  },

  syncGoogleCalendar: async () => ({
    connected: false,
    events: [],
    message: 'Google Calendar sync not configured locally',
  }),

  apiTimeTracker: async (body) => ({ success: true, data: body }),

  getNextWorkingReportNumber: async (body) => ({
    report_number: await getNextCounter('working_report', body?.branch_id),
  }),

  getNextWorkOrderNumber: async () => ({
    work_order_number: await getNextCounter('work_order'),
  }),

  getNextWorkOrderNumberAtomic: async () => ({
    work_order_number: await getNextCounter('work_order'),
  }),

  getNextClientNumber: async () => ({
    client_number: `CL-${String(await getNextCounter('client')).padStart(4, '0')}`,
  }),

  getNextProjectNumber: async () => ({
    project_number: `PR-${String(await getNextCounter('project')).padStart(4, '0')}`,
  }),

  generateEmployeeNumber: async () => ({
    employee_number: `EMP-${String(await getNextCounter('employee')).padStart(4, '0')}`,
  }),

  exportPettyCash: async () => ({ url: null, message: 'Local export not implemented' }),
  exportDocumentsZip: async () => ({ url: null, message: 'Local export not implemented' }),
  exportPaySlipPDF: async () => ({ url: null, message: 'Local export not implemented' }),
  exportPayrollRunPDF: async () => ({ url: null, message: 'Local export not implemented' }),
  exportPayrollRunExcel: async () => ({ url: null, message: 'Local export not implemented' }),
  mergeDocumentsPdf: async () => ({ url: null, message: 'Local export not implemented' }),
  createPreviewUrl: async (body) => ({ url: body?.file_uri || body?.url || null }),
  createRecurringWorkOrders: async () => ({ created: 0 }),
  syncWorkOrderTeams: async () => ({ success: true }),
  solveWorkOrderOverlaps: async () => ({ resolved: 0 }),
  runRenumberWorkOrdersApply: async () => ({ success: true }),
  backfillMissingWon: async () => ({ success: true, updated: 0 }),
  mergeCompanies: async () => ({ success: true, merged: 0 }),
  assignUsersToCompany: async () => ({ success: true }),
  createInvitation: async (body) => ({ success: true, invitation: body }),
  repairEmployeeDocumentTypes: async () => ({ success: true, repaired: 0 }),
  assignAllUsersToRedcrane: async () => ({ success: true }),
  approveLeaveRequest: async () => ({ success: true }),
  resolveShortUrl: async (body) => ({ resolved_url: body?.url || null }),
};
