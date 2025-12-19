import { useEffect, useState } from "react";
import { coursesApi } from "../../api/auth.api";
import type { CourseListItem } from "../../utils/types/courses";
import CoursesListItem from "../../components/CoursesListItem";
import { useUserStore } from "../../store/store";

function CoursesList () {
    const [isLoading, setIsLoading] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    const [courses, setCourses] = useState<CourseListItem[]>([])
    const [next, setNext] = useState<string | null>(null)
    const [count, setCount] = useState(0)
    const {user} = useUserStore()
    console.log(user)

    useEffect(() => {
        const fetchCourses = async() => {
            try {
                const data = await coursesApi.courses()
                setCount(data.count)
                setNext(data.next)
                setCourses(data.results)
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
                    <CoursesListItem course={course}/>
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