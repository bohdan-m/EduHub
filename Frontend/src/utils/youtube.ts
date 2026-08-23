export function getYoutubeEmbedUrl(value: string) {
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
    } catch {
        return null;
    }

    return null;
}
