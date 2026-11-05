import test from "node:test";
import assert from "node:assert/strict";
import { getVideoEmbedUrl } from "../src/utils/youtube.js";

test("converts standard youtube watch urls", () => {
    assert.equal(
        getVideoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
});

test("converts short youtube urls", () => {
    assert.equal(
        getVideoEmbedUrl("https://youtu.be/aqz-KE-bpKQ"),
        "https://www.youtube.com/embed/aqz-KE-bpKQ",
    );
});

test("converts shorts urls", () => {
    assert.equal(
        getVideoEmbedUrl("https://www.youtube.com/shorts/aqz-KE-bpKQ"),
        "https://www.youtube.com/embed/aqz-KE-bpKQ",
    );
});

test("converts vimeo links to the player", () => {
    assert.equal(getVideoEmbedUrl("https://vimeo.com/12345"), "https://player.vimeo.com/video/12345");
    assert.equal(getVideoEmbedUrl("https://vimeo.com/channels/staffpicks/12345"), "https://player.vimeo.com/video/12345");
    assert.equal(getVideoEmbedUrl("https://player.vimeo.com/video/12345"), "https://player.vimeo.com/video/12345");
});

test("rejects unsupported hosts", () => {
    assert.equal(getVideoEmbedUrl("https://example.com/watch?v=12345"), null);
});

test("rejects malformed urls", () => {
    assert.equal(getVideoEmbedUrl("not-a-url"), null);
});
