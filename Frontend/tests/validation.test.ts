import test from "node:test";
import assert from "node:assert/strict";
import {
    validateEmail,
    validateImages,
    validateName,
    validatePassword,
    validateText,
    validateYoutubeUrl,
} from "../src/utils/validation.js";

test("name: required, trimmed, capped", () => {
    assert.equal(validateName("Ada"), null);
    assert.equal(validateName("   "), "Enter your name.");
    assert.match(validateName("x".repeat(101)) ?? "", /under 100/);
});

test("email: required and shaped like an address", () => {
    assert.equal(validateEmail("ada@example.com"), null);
    assert.equal(validateEmail(""), "Enter your email address.");
    for (const bad of ["ada", "ada@", "ada@example", "a da@example.com"]) {
        assert.ok(validateEmail(bad), bad);
    }
});

test("password: length only enforced for new passwords", () => {
    assert.equal(validatePassword("", { isNew: false }), "Enter your password.");
    assert.equal(validatePassword("short", { isNew: false }), null);
    assert.equal(validatePassword("short", { isNew: true }), "Use at least 8 characters.");
    assert.equal(validatePassword("long-enough", { isNew: true }), null);
    assert.ok(validatePassword("x".repeat(129), { isNew: true }));
});

test("text: blank and over-long values are rejected", () => {
    assert.equal(validateText("Intro", "Stage title", 100), null);
    assert.equal(validateText("  ", "Stage title", 100), "Enter a stage title.");
    assert.equal(validateText("x".repeat(101), "Stage title", 100), "Stage title must be 100 characters or fewer.");
});

test("youtube link: optional, but must be embeddable", () => {
    assert.equal(validateYoutubeUrl(""), null);
    assert.equal(validateYoutubeUrl("https://youtu.be/dQw4w9WgXcQ"), null);
    assert.ok(validateYoutubeUrl("https://vimeo.com/123"));
    assert.ok(validateYoutubeUrl("not a url"));
});

test("images: count, type and size", () => {
    const png = { name: "a.png", size: 1000, type: "image/png" };
    assert.equal(validateImages([png]), null);
    assert.ok(validateImages(Array(6).fill(png)));
    assert.match(validateImages([{ name: "notes.pdf", size: 10, type: "application/pdf" }]) ?? "", /isn't an image/);
    assert.match(validateImages([{ ...png, size: 6 * 1024 * 1024 }]) ?? "", /over 5 MB/);
});
