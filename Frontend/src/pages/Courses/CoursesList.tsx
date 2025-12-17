import { useEffect, useState } from "react";
import { coursesApi, type CourseListItem } from "../../api/auth.api";

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
                <li key={course.id}>{course.title}</li>
                ))}
            </ul>
            ) : (
            <p>No courses yet</p>
            )}
        </div>
    )
};

export default CoursesList