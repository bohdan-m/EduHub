// Server components fetch the API directly over the internal network (API_INTERNAL_URL, e.g. http://web:8000 in
// Docker) as a guest. Image links in the answers point at that internal host, so they're rewritten to the public one.
const internal = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");
const publicUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

/** The JSON at an API path, or null when it is missing (404), private or the API can't be reached. */
export async function serverApi<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const response = await fetch(`${internal}/api${path}`, { next: { revalidate }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const text = await response.text();
    return JSON.parse(internal === publicUrl ? text : text.replaceAll(`${internal}/`, `${publicUrl}/`)) as T;
  } catch {
    // the page then renders on the client as before; metadata falls back to the defaults
    return null;
  }
}

/** The site's public address, for canonical and social-preview links. */
export const siteUrl = (process.env.BETTER_AUTH_URL ?? "http://localhost:5173").replace(/\/$/, "");
