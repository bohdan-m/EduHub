import { useEffect, useState } from "react";
import { coursesApi } from "../../api/auth.api";
import type { CourseListItem } from "../../utils/types/courses";

function CoursesList () {
    const [isLoading, setIsLoading] = useState(true)
    const [courses, setCourses] = useState<CourseListItem[]>([])

    useEffect(() => {
        const fetchCourses = async() => {
            try {
                const data = await coursesApi.courses()
                setCourses(data)
            } catch (error) {
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }
        fetchCourses()
    }, [])

    if (isLoading) {return <p>Loading...</p>}

    return (
        <div>
            {courses.length > 0 ? (
            <ul>
                {courses.map(course => (
                <li key={course.id}>
                    {course.title}
                    {course.description}
                    {course.author}
                    <ul>
                        {course.images.map(image => (
                            <li key={image.id}>{image.image}</li>
                        ))}
                    </ul>
                </li>
                ))}
            </ul>
            ) : (
            <p>No courses yet</p>
            )}
        </div>
    )
};

export default CoursesList