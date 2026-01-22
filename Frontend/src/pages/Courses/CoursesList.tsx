import { useEffect, useState } from "react";
import { coursesApi } from "../../api/auth.api";
import type { CourseListItem } from "../../utils/types/courses";
import CoursesListItem from "../../components/Courses/CoursesListItem";
import { useInView } from "react-intersection-observer";
import styles from "./Courses.module.css"
import DescriptionPage from "../../components/Header/DescriptionPage";

function CoursesList () {
    const [isLoading, setIsLoading] = useState(true)
    const [isFetchingMore, setIsFetchingMore] = useState(false)

    const [courses, setCourses] = useState<CourseListItem[]>([])
    const [next, setNext] = useState<string | null>(null)

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
            <DescriptionPage header="Online Courses from Qualified Teachers" description="Welcome to our online courses page, where you can improve your skills in any field. Choose one of our courses, designed to provide you with comprehensive knowledge and practical experience from qualified instructors. Explore the courses below and find the one that is perfect for your learning needs." />
            {courses.length > 0 ? (
            <ul className={styles.coursesContainer}>
                {courses.map(course => (
                <li className={styles.coursesList} key={course.id}>
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

export default CoursesList;