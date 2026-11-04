import test from "node:test";
import assert from "node:assert/strict";
import { parseDraftData } from "../src/utils/draftData.js";

test("parseDraftData accepts what the builder saves and rejects anything else", () => {
    const draft = { title: "T", description: "", stages: [{ key: "s", title: "", lessons: [{ key: "l", title: "", blocks: [] }] }] };
    assert.deepEqual(parseDraftData(draft), draft);

    for (const data of [null, "text", {}, { title: "T", description: "", stages: "nope" },
        { title: "T", description: "", stages: [{ title: "", lessons: [] }] },
        { title: "T", description: "", stages: [{ key: "s", title: "", lessons: [{ key: "l", title: "" }] }] }]) {
        assert.equal(parseDraftData(data), null, JSON.stringify(data));
    }
});
