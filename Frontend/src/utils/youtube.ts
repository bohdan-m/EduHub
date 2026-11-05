/** The embeddable player URL for a YouTube or Vimeo link (the only hosts lessons embed), or null. */
export function getVideoEmbedUrl(value: string) {
    if (!value) {
        return null;
    }

    try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");

        if (host === "youtu.be") {
            const videoId = url.pathname.slice(1);
            return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
        }

        if (host === "youtube.com" || host === "m.youtube.com") {
            if (url.pathname === "/watch") {
                const videoId = url.searchParams.get("v");
                return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
            }

            if (url.pathname.startsWith("/embed/")) {
                return value;
            }

            if (url.pathname.startsWith("/shorts/")) {
                const videoId = url.pathname.split("/")[2];
                return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
            }
        }

        if (host === "vimeo.com" || host === "player.vimeo.com") {
            // vimeo.com/123, vimeo.com/channels/x/123 and player.vimeo.com/video/123 all end in the numeric id
            const videoId = url.pathname.split("/").filter(Boolean).reverse().find((part) => /^\d+$/.test(part));
            return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
        }
    } catch {
        return null;
    }

    return null;
}

