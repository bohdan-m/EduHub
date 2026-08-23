import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { coursesApi } from "../../api/auth.api";
import type { CourseDetail as CourseDetailItem, LessonItem } from "../../utils/types/courses";
import { getYoutubeEmbedUrl } from "../../utils/youtube";
import styles from "./CourseDetail.module.css";

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function getFirstPlayableLesson(course: CourseDetailItem) {
    for (const stage of course.stages) {
        const lesson = stage.lessons.find((item) => Boolean(getYoutubeEmbedUrl(item.url)));
        if (lesson) {
            return lesson;
        }
    }

    return null;
}

function CourseDetail() {
    const navigate = useNavigate();
    const { courseId } = useParams();

    const [course, setCourse] = useState<CourseDetailItem | null>(null);
    const [selectedLesson, setSelectedLesson] = useState<LessonItem | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchCourse = async () => {
            if (!courseId) {
                setError("Course not found.");
                setIsLoading(false);
                return;
            }

            try {
                setIsLoading(true);
                setError("");
                const data = await coursesApi.courseDetail(courseId);
                setCourse(data);
                setSelectedLesson(getFirstPlayableLesson(data));
            } catch (fetchError) {
                console.error(fetchError);
                setError("We could not load this course right now.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchCourse();
    }, [courseId]);

    if (isLoading) {
        return <div className={styles.feedback}>Loading course...</div>;
    }

    if (error || !course) {
        return (
            <section className={styles.feedbackSection}>
                <p className={styles.feedback}>{error || "Course not found."}</p>
                <button className={styles.backButton} onClick={() => navigate("/home")} type="button">
                    Back to courses
                </button>
            </section>
        );
    }

    const selectedVideoUrl = selectedLesson ? getYoutubeEmbedUrl(selectedLesson.url) : null;

    return (
        <section className={styles.page}>
            <button className={styles.backButton} onClick={() => navigate("/home")} type="button">
                Back to courses
            </button>

            <article className={styles.hero}>
                <div className={styles.copy}>
                    <p className={styles.eyebrow}>Course overview</p>
                    <h1 className={styles.title}>{course.title}</h1>
                    <p className={styles.description}>{course.description}</p>
                </div>

                <div className={styles.metaCard}>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Instructor</span>
                        <span className={styles.metaValue}>{course.author.username}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Published</span>
                        <span className={styles.metaValue}>{formatDate(course.created_at)}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaLabel}>Stages</span>
                        <span className={styles.metaValue}>{course.stages.length}</span>
                    </div>
                </div>
            </article>

            {course.images.length > 0 && (
                <ul className={styles.imageGrid}>
                    {course.images.map((image, index) => (
                        <li className={styles.imageItem} key={image.id}>
                            <img
                                alt={`${course.title} preview ${index + 1}`}
                                className={styles.image}
                                src={image.image}
                            />
                        </li>
                    ))}
                </ul>
            )}

            <section className={styles.playerSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Lesson player</h2>
                    <p className={styles.sectionText}>
                        Watch the selected lesson directly inside the course page.
                    </p>
                </div>

                {selectedLesson && selectedVideoUrl ? (
                    <div className={styles.playerCard}>
                        <div className={styles.playerFrame}>
                            <iframe
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                                className={styles.iframe}
                                referrerPolicy="strict-origin-when-cross-origin"
                                src={selectedVideoUrl}
                                title={selectedLesson.title}
                            />
                        </div>
                        <div className={styles.playerMeta}>
                            <span className={styles.playerLabel}>Now playing</span>
                            <h3 className={styles.playerTitle}>{selectedLesson.title}</h3>
                        </div>
                    </div>
                ) : (
                    <div className={styles.playerPlaceholder}>
                        <p className={styles.emptyState}>No playable YouTube lesson is available for this course yet.</p>
                    </div>
                )}
            </section>

            <section className={styles.curriculumSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Curriculum</h2>
                    <p className={styles.sectionText}>
                        A structured breakdown of the course content by stage and lesson.
                    </p>
                </div>

                {course.stages.length > 0 ? (
                    <div className={styles.stageGrid}>
                        {course.stages.map((stage) => (
                            <article className={styles.stageCard} key={stage.id}>
                                <div className={styles.stageHeader}>
                                    <span className={styles.stageNumber}>
                                        {String(stage.order).padStart(2, "0")}
                                    </span>
                                    <h3 className={styles.stageTitle}>{stage.title}</h3>
                                </div>

                                {stage.lessons.length > 0 ? (
                                    <ol className={styles.lessonList}>
                                        {stage.lessons.map((lesson) => (
                                            <li key={lesson.id}>
                                                <button
                                                    className={`${styles.lessonButton} ${selectedLesson?.id === lesson.id ? styles.lessonButtonActive : ""}`}
                                                    onClick={() => setSelectedLesson(lesson)}
                                                    type="button"
                                                >
                                                    <span className={styles.lessonItem}>
                                                        <span className={styles.lessonOrder}>
                                                            Lesson {String(lesson.order).padStart(2, "0")}
                                                        </span>
                                                        <span className={styles.lessonTitle}>{lesson.title}</span>
                                                        <span className={styles.lessonStatus}>
                                                            {getYoutubeEmbedUrl(lesson.url) ? "Playable" : "Unavailable"}
                                                        </span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className={styles.emptyState}>Lessons for this stage will be added soon.</p>
                                )}
                            </article>
                        ))}
                    </div>
                ) : (
                    <p className={styles.emptyState}>This course does not have curriculum stages yet.</p>
                )}
            </section>
        </section>
    );
}

export default CourseDetail;
