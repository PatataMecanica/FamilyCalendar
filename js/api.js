// Acceso a Google Calendar API v3 (REST). En modo demo se sustituye por un backend en memoria.

import { getToken, clearToken } from './auth.js';
import { stripNulls } from './model.js';

const BASE = 'https://www.googleapis.com/calendar/v3';

export class AuthError extends Error {}
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function req(method, path, { query, body } = {}) {
  const token = getToken();
  if (!token) throw new AuthError('Sesión caducada');
  const url = new URL(BASE + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
      else url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { clearToken(); throw new AuthError('Sesión caducada'); }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data.error && data.error.message) || `Error ${res.status}`);
  return data;
}

const enc = encodeURIComponent;

export const googleApi = {
  async listCalendars() {
    const data = await req('GET', '/users/me/calendarList', { query: { minAccessRole: 'writer', maxResults: 250 } });
    return data.items || [];
  },

  /** Lista eventos expandidos (instancias de recurrentes) en el rango */
  async listEvents(calId, { timeMin, timeMax, q, shared, maxResults = 2500 } = {}) {
    let items = [];
    let pageToken;
    do {
      const data = await req('GET', `/calendars/${enc(calId)}/events`, {
        query: {
          singleEvents: 'true', orderBy: 'startTime', showDeleted: 'false',
          timeMin: timeMin && timeMin.toISOString(), timeMax: timeMax && timeMax.toISOString(),
          q, sharedExtendedProperty: shared, maxResults: Math.min(maxResults, 2500), pageToken,
        },
      });
      items = items.concat(data.items || []);
      pageToken = data.nextPageToken;
    } while (pageToken && items.length < maxResults);
    return items.filter((e) => e.status !== 'cancelled');
  },

  getEvent(calId, id) { return req('GET', `/calendars/${enc(calId)}/events/${enc(id)}`); },
  insertEvent(calId, body) { return req('POST', `/calendars/${enc(calId)}/events`, { body: stripNulls(body) }); },
  patchEvent(calId, id, body) { return req('PATCH', `/calendars/${enc(calId)}/events/${enc(id)}`, { body }); },
  deleteEvent(calId, id) { return req('DELETE', `/calendars/${enc(calId)}/events/${enc(id)}`); },
};
