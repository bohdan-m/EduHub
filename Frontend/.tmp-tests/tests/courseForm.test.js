import test from "node:test";
import assert from "node:assert/strict";
import { buildCourseCreatePayload } from "../src/utils/courseForm.js";
test("buildCourseCreatePayload trims fields and assigns incremental order", () => {
    const payload = buildCourseCreatePayload({
        title: "  UX Research  ",
        description: "  Learn the process  ",
        stages: [
            {
                id: "stage-1",
                title: "  Discover  ",
                lessons: [
                    {
                        id: "lesson-1",
                        title: "  Interviews  ",
                        url: "  https://youtu.be/aqz-KE-bpKQ  ",
                    },
                    {
                        id: "lesson-2",
                        title: "  Surveys ",
                        url: "",
                    },
                ],
            },
            {
                id: "stage-2",
                title: " Define ",
                lessons: [
                    {
                        id: "lesson-3",
                        title: " Synthesis ",
                        url: " https://www.youtube.com/watch?v=dQw4w9WgXcQ ",
                    },
                ],
            },
        ],
    }, []);
    assert.equal(payload.title, "UX Research");
    assert.equal(payload.description, "Learn the process");
    assert.deepEqual(payload.stages, [
        {
            title: "Discover",
            order: 1,
            lessons: [
                {
                    title: "Interviews",
                    url: "https://youtu.be/aqz-KE-bpKQ",
                    order: 1,
                },
                {
                    title: "Surveys",
                    url: "",
                    order: 2,
                },
            ],
        },
        {
            title: "Define",
            order: 2,
            lessons: [
                {
                    title: "Synthesis",
                    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
                    order: 1,
                },
            ],
        },
    ]);
    assert.deepEqual(payload.uploaded_images, []);
});
