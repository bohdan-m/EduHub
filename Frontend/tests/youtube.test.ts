import test from "node:test";
import assert from "node:assert/strict";
import { getYoutubeEmbedUrl } from "../src/utils/youtube.js";

test("converts standard youtube watch urls", () => {
    assert.equal(
        getYoutubeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
    );
});

test("converts short youtube urls", () => {
    assert.equal(
        getYoutubeEmbedUrl("https://youtu.be/aqz-KE-bpKQ"),
        "https://www.youtube.com/embed/aqz-KE-bpKQ",
    );
});

test("converts shorts urls", () => {
    assert.equal(
        getYoutubeEmbedUrl("https://www.youtube.com/shorts/aqz-KE-bpKQ"),
        "https://www.youtube.com/embed/aqz-KE-bpKQ",
    );
});

test("rejects unsupported hosts", () => {
    assert.equal(getYoutubeEmbedUrl("https://vimeo.com/12345"), null);
});

test("rejects malformed urls", () => {
    assert.equal(getYoutubeEmbedUrl("not-a-url"), null);
});
