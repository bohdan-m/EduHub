import type { CourseListItem } from "../../utils/types/courses";
import styles from "./CoursesList.module.css";

interface CoursesListItemProps {
    course: CourseListItem;
}

function CoursesListItem({ course }: CoursesListItemProps) {
    return (
        <div className={styles.container}>
            <div className={styles.headerContainer}>
                <div className={styles.headerContent}>
                    <p className={styles.headerText1}>{course.title}</p>
                    <p className={styles.headerText2}>{course.description}</p>
                </div>
                <button className={styles.button}>View Course</button>
            </div>
            <ul className={styles.imagesContainer}>
                {course.images.map(image => (
                    <li className={styles.courseList} key={image.id}>
                        <img className={styles.image} alt={image.image} src={`${image.image}`} />
                    </li>
                ))}
            </ul>
            <div className={styles.footerContainer}>
                <div className={styles.date}>
                    <p>{course.created_at.slice(0, course.created_at.indexOf('T'))}</p>
                </div>
                <p className={styles.author}>By {course.author.username}</p>
            </div>
            <div className={styles.stagesContainer}>
                <p className={styles.stageText}>Curriculum</p>
                <ul className={styles.stagesContent}>
                    {course.stages.map(stage => (
                        <div className={styles.stage}>
                            <p className={styles.stageOrder}>0{stage.order}</p>
                            <p className={styles.stageTitle}>{stage.title}</p>
                        </div>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default CoursesListItem;
