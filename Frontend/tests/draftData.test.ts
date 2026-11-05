import test from "node:test";
import assert from "node:assert/strict";
import { emptyDetails } from "../src/utils/courseForm.js";
import { parseDraftData } from "../src/utils/draftData.js";

test("parseDraftData accepts what the builder saves and rejects anything else", () => {
    const draft = { title: "T", description: "", stages: [{ key: "s", title: "", lessons: [{ key: "l", title: "", blocks: [] }] }] };
    // older drafts come back with the default course details filled in
    assert.deepEqual(parseDraftData(draft), { ...draft, details: emptyDetails() });

    for (const data of [null, "text", {}, { title: "T", description: "", stages: "nope" },
        { title: "T", description: "", stages: [{ title: "", lessons: [] }] },
        { title: "T", description: "", stages: [{ key: "s", title: "", lessons: [{ key: "l", title: "" }] }] }]) {
        assert.equal(parseDraftData(data), null, JSON.stringify(data));
    }
});
