const DEFAULT_API_BASE_URL = 'https://geosurvey-backend-5yz2avrqwa-ew.a.run.app';

export const API_BASE_URL = String((import.meta as any).env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '');

export const apiFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (url.startsWith('/api/')) {
    return fetch(`${API_BASE_URL}${url}`, init);
  }
  return fetch(input, init);
};
