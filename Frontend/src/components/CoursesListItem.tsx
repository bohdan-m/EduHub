import type { CourseListItem } from "../utils/types/courses";

interface CoursesListItemProps {
    course: CourseListItem;
}

function CoursesListItem({ course }: CoursesListItemProps) {
    return (
        <div>
            <p>{course.title}</p>
            <p>{course.description}</p>
            <p>{course.author.username}</p>
            <ul>
                {course.images.map(image => (
                    <li key={image.id}>
                        <img alt={image.image} src={`${image.image}`} />
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default CoursesListItem;
