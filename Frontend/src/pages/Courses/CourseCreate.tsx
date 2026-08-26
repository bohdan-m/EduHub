import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { coursesApi } from "../../api/auth.api";
import { useUserStore } from "../../store/store";
import { buildCourseCreatePayload, type CourseComposerStage, type CourseComposerValues } from "../../utils/courseForm";
import { getApiErrorMessage } from "../../utils/apiError";
import styles from "./CourseCreate.module.css";

const createId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyLesson = () => ({
    id: createId(),
    title: "",
    url: "",
});

const createEmptyStage = (): CourseComposerStage => ({
    id: createId(),
    title: "",
    lessons: [createEmptyLesson()],
});

function CourseCreate() {
    const navigate = useNavigate();
    const user = useUserStore((state) => state.user);
    const isTeacher = user?.role === "teacher";

    const [values, setValues] = useState<CourseComposerValues>({
        title: "",
        description: "",
        stages: [createEmptyStage()],
    });
    const [uploadedImages, setUploadedImages] = useState<File[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const totalLessons = useMemo(
        () => values.stages.reduce((count, stage) => count + stage.lessons.length, 0),
        [values.stages],
    );

    const updateStage = (stageId: string, updater: (stage: CourseComposerStage) => CourseComposerStage) => {
        setValues((current) => ({
            ...current,
            stages: current.stages.map((stage) => (stage.id === stageId ? updater(stage) : stage)),
        }));
    };

    const validateForm = () => {
        if (!values.title.trim()) {
            return "Course title is required.";
        }

        if (!values.description.trim()) {
            return "Course description is required.";
        }

        if (values.stages.length === 0) {
            return "Add at least one stage.";
        }

        for (const stage of values.stages) {
            if (!stage.title.trim()) {
                return "Every stage needs a title.";
            }

            if (stage.lessons.length === 0) {
                return "Every stage needs at least one lesson.";
            }

            for (const lesson of stage.lessons) {
                if (!lesson.title.trim()) {
                    return "Every lesson needs a title.";
                }
            }
        }

        return "";
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            setSuccess("");
            return;
        }

        try {
            setIsSubmitting(true);
            setError("");
            setSuccess("");

            const payload = buildCourseCreatePayload(values, uploadedImages);
            const course = await coursesApi.createCourse(payload);

            setSuccess("Course created successfully. Redirecting to the course page.");
            setTimeout(() => navigate(`/courses/${course.id}`), 500);
        } catch (submitError) {
            setError(getApiErrorMessage(submitError));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isTeacher) {
        return (
            <section className={styles.authNotice}>
                <h1 className={styles.sectionTitle}>Teacher access required</h1>
                <p className={styles.sectionText}>
                    Only teacher accounts can publish courses. Sign in with a teacher profile to create a new curriculum.
                </p>
                <button className={styles.primaryButton} onClick={() => navigate("/home")} type="button">
                    Back to courses
                </button>
            </section>
        );
    }

    return (
        <section className={styles.page}>
            <div className={styles.hero}>
                <div className={styles.heroCopy}>
                    <p className={styles.eyebrow}>Course composer</p>
                    <h1 className={styles.title}>Build a course with clear stages and lessons.</h1>
                    <p className={styles.subtitle}>
                        Create the structure first, keep the interface clean, and publish a course that fits the rest of the platform.
                    </p>
                </div>

                <aside className={styles.heroAside}>
                    <h2 className={styles.asideTitle}>What will be published</h2>
                    <ul className={styles.asideList}>
                        <li>{values.stages.length} structured stage{values.stages.length === 1 ? "" : "s"}</li>
                        <li>{totalLessons} lesson{totalLessons === 1 ? "" : "s"} ready for playback</li>
                        <li>{uploadedImages.length} preview image{uploadedImages.length === 1 ? "" : "s"} attached</li>
                    </ul>
                </aside>
            </div>

            {error && <div className={styles.errorBox}>{error}</div>}
            {success && <div className={styles.successBox}>{success}</div>}

            <form className={styles.form} onSubmit={handleSubmit}>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleWrap}>
                            <h2 className={styles.sectionTitle}>Course details</h2>
                            <p className={styles.sectionText}>Start with the essentials learners will see before they open the curriculum.</p>
                        </div>
                    </div>

                    <div className={styles.fieldGrid}>
                        <label className={styles.field}>
                            <span className={styles.label}>Title</span>
                            <input
                                className={styles.input}
                                onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
                                placeholder="Product Design Foundations"
                                type="text"
                                value={values.title}
                            />
                        </label>

                        <label className={styles.field}>
                            <span className={styles.label}>Preview images</span>
                            <input
                                accept="image/*"
                                className={styles.input}
                                multiple
                                onChange={(event) => setUploadedImages(Array.from(event.target.files ?? []))}
                                type="file"
                            />
                            <span className={styles.hint}>Optional. Up to three images works best with the current course cards.</span>
                        </label>

                        <label className={`${styles.field} ${styles.fieldWide}`}>
                            <span className={styles.label}>Description</span>
                            <textarea
                                className={styles.textarea}
                                onChange={(event) => setValues((current) => ({ ...current, description: event.target.value }))}
                                placeholder="Explain the outcome, teaching approach, and who this course is for."
                                value={values.description}
                            />
                        </label>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitleWrap}>
                            <h2 className={styles.sectionTitle}>Curriculum</h2>
                            <p className={styles.sectionText}>Arrange the course in stages. Each stage can contain one or more lessons.</p>
                        </div>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => setValues((current) => ({ ...current, stages: [...current.stages, createEmptyStage()] }))}
                            type="button"
                        >
                            Add stage
                        </button>
                    </div>

                    <div className={styles.stageList}>
                        {values.stages.map((stage, stageIndex) => (
                            <article className={styles.stageCard} key={stage.id}>
                                <div className={styles.stageCardHeader}>
                                    <div className={styles.stageMeta}>
                                        <span className={styles.stageBadge}>Stage {stageIndex + 1}</span>
                                        <h3 className={styles.stageHeading}>{stage.title.trim() || "Untitled stage"}</h3>
                                    </div>
                                    {values.stages.length > 1 && (
                                        <button
                                            className={styles.dangerButton}
                                            onClick={() =>
                                                setValues((current) => ({
                                                    ...current,
                                                    stages: current.stages.filter((item) => item.id !== stage.id),
                                                }))
                                            }
                                            type="button"
                                        >
                                            Remove stage
                                        </button>
                                    )}
                                </div>

                                <div className={styles.stageCardBody}>
                                    <label className={styles.field}>
                                        <span className={styles.label}>Stage title</span>
                                        <input
                                            className={styles.input}
                                            onChange={(event) =>
                                                updateStage(stage.id, (currentStage) => ({
                                                    ...currentStage,
                                                    title: event.target.value,
                                                }))
                                            }
                                            placeholder="Research and framing"
                                            type="text"
                                            value={stage.title}
                                        />
                                    </label>

                                    <div className={styles.lessonList}>
                                        {stage.lessons.map((lesson, lessonIndex) => (
                                            <div className={styles.lessonCard} key={lesson.id}>
                                                <div className={styles.lessonHeader}>
                                                    <span className={styles.lessonIndex}>Lesson {lessonIndex + 1}</span>
                                                    {stage.lessons.length > 1 && (
                                                        <button
                                                            className={styles.ghostButton}
                                                            onClick={() =>
                                                                updateStage(stage.id, (currentStage) => ({
                                                                    ...currentStage,
                                                                    lessons: currentStage.lessons.filter((item) => item.id !== lesson.id),
                                                                }))
                                                            }
                                                            type="button"
                                                        >
                                                            Remove lesson
                                                        </button>
                                                    )}
                                                </div>

                                                <div className={styles.fieldGrid}>
                                                    <label className={styles.field}>
                                                        <span className={styles.label}>Lesson title</span>
                                                        <input
                                                            className={styles.input}
                                                            onChange={(event) =>
                                                                updateStage(stage.id, (currentStage) => ({
                                                                    ...currentStage,
                                                                    lessons: currentStage.lessons.map((item) =>
                                                                        item.id === lesson.id ? { ...item, title: event.target.value } : item,
                                                                    ),
                                                                }))
                                                            }
                                                            placeholder="User interviews in practice"
                                                            type="text"
                                                            value={lesson.title}
                                                        />
                                                    </label>

                                                    <label className={styles.field}>
                                                        <span className={styles.label}>Video URL</span>
                                                        <input
                                                            className={styles.input}
                                                            onChange={(event) =>
                                                                updateStage(stage.id, (currentStage) => ({
                                                                    ...currentStage,
                                                                    lessons: currentStage.lessons.map((item) =>
                                                                        item.id === lesson.id ? { ...item, url: event.target.value } : item,
                                                                    ),
                                                                }))
                                                            }
                                                            placeholder="https://www.youtube.com/watch?v=..."
                                                            type="url"
                                                            value={lesson.url}
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className={styles.actionRow}>
                                        <button
                                            className={styles.ghostButton}
                                            onClick={() =>
                                                updateStage(stage.id, (currentStage) => ({
                                                    ...currentStage,
                                                    lessons: [...currentStage.lessons, createEmptyLesson()],
                                                }))
                                            }
                                            type="button"
                                        >
                                            Add lesson
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>

                    {values.stages.length === 0 && <div className={styles.emptyState}>Add a stage to begin building the course.</div>}
                </section>

                <div className={styles.footerBar}>
                    <p className={styles.feedback}>Stages and lessons are ordered automatically based on the layout above.</p>
                    <div className={styles.actionRow}>
                        <button className={styles.secondaryButton} onClick={() => navigate("/home")} type="button">
                            Cancel
                        </button>
                        <button className={styles.primaryButton} disabled={isSubmitting} type="submit">
                            {isSubmitting ? "Publishing..." : "Publish course"}
                        </button>
                    </div>
                </div>
            </form>
        </section>
    );
}

export default CourseCreate;
