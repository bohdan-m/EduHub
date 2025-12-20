import { useEffect, useState } from "react";
import { coursesApi } from "../../api/auth.api";
import type { CourseListItem } from "../../utils/types/courses";
import CoursesListItem from "../../components/CoursesListItem";
import { useUserStore } from "../../store/store";
import { useInView } from "react-intersection-observer";

function CoursesList () {
    const [isLoading, setIsLoading] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    const [courses, setCourses] = useState<CourseListItem[]>([])
    const [next, setNext] = useState<string | null>(null)
    const [count, setCount] = useState(0)
    const {user} = useUserStore()

    const {ref, inView} = useInView({
        threshold: 0,
        rootMargin: '100px',
    });

    useEffect(() => {
        fetchCourses()
    }, [])

    useEffect(() => {
        if (inView && next && !isFetchingMore && !isLoading) {
            fetchCourses(next.slice(next.indexOf('/courses/')));
        }
    }, [inView, next, isFetchingMore, isLoading])

    const fetchCourses = async (url: string = "/courses/") => {
        try {
            const isInitialLoad = url === "/courses/"
            
            if (isInitialLoad) {
                setIsLoading(true)
            } else {
                setIsFetchingMore(true)
            }
    
            const data = await coursesApi.courses(url)

            setCount(data.count)
            setNext(data.next)
            setCourses(prev => [...prev, ...data.results])
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
            setIsFetchingMore(false)
        }
    }

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
                {next && (
                    <li ref={ref} style={{minHeight: '20px'}}>
                        {isFetchingMore && <p>Loading more...</p>}
                    </li>
                )}
            </ul>
            ) : (
            <p>No courses yet</p>
            )}
        </div>
    )
};

export default CoursesList