import {getToken} from './auth';

export const fetchJSON = async (url, payload = null, method = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const data = payload
    ? {
        headers,
        body: JSON.stringify(payload),
        method: method || 'POST',
      }
    : {headers, method: method || 'GET'};
  const resp = await fetch(url, data);
  return [resp.status, await resp.json()];
};
