import type { ISpool } from '@/types/spoolman';

export function normalizeUrl(base: string): string {
  return base.replace(/\/+$/, '');
}

export interface SpoolListParams {
  allowArchived?: boolean;
  search?: string;
}

export async function fetchSpools(
  baseUrl: string,
  params: SpoolListParams = {}
): Promise<ISpool[]> {
  const url = new URL(`${normalizeUrl(baseUrl)}/api/v1/spool`);
  if (params.allowArchived) {
    url.searchParams.set('allow_archived', 'true');
  }

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Spoolman API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Spoolman returns a plain array
  if (Array.isArray(data)) return data as ISpool[];
  // Or wrapped
  if (data && Array.isArray(data.items)) return data.items as ISpool[];
  return [];
}

export async function testConnection(baseUrl: string): Promise<string> {
  const url = `${normalizeUrl(baseUrl)}/api/v1/info`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Connection failed: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data?.version ?? 'unknown';
}
