"""Seeds the demo courses on an empty database (no user accounts). Run: python -m app.seed"""
import logging
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.content import course_totals
from app.db import SessionLocal
from app.models import Course, CourseImage, Lesson, Stage

logger = logging.getLogger(__name__)


def get_course_data():
    return {
        "programming": {
            "title": "Programming from Zero to Hero",
            "description": "Learn the fundamentals of programming step by step...",
            "images": [
                'programming1.jpg',
                'programming2.jpg',
                'programming3.jpg',
            ],
            "stages": [
                {
                    "order": 1,
                    "title": "Introduction to Programming",
                    "lessons": [
                        ("What is Programming and How It Works", "https://www.youtube.com/watch?v=RzjWJHwFL-E"),
                        ("How Computers Understand Code", "https://www.youtube.com/watch?v=QXjU9qTsYCc"),
                        ("Installing Python and Your First Program", "https://www.youtube.com/watch?v=YYXdXT2l-Gg"),
                    ],
                },
                {
                    "order": 2,
                    "title": "Programming Basics",
                    "lessons": [
                        ("Variables and Data Types", "https://www.youtube.com/watch?v=ohCDWZgNIU0"),
                        (
                            "Operators and Expressions",
                            "https://www.youtube.com/watch?v=GEMZpw7ug-k&list=PLBlnK6fEyqRjdKzSsGiBpr6fAxawT9WWb",
                        ),
                        ("Conditional Statements (if, else, elif)", "https://www.youtube.com/watch?v=f4KOjWS_KZs"),
                        ("Loops (for, while)", "https://www.youtube.com/watch?v=6iF8Xb7Z3wQ"),
                    ],
                },
                {
                    "order": 3,
                    "title": "Working with Data",
                    "lessons": [
                        ("Lists and Tuples", "https://www.youtube.com/watch?v=W8KRzm-HUcc"),
                        ("Dictionaries and Sets", "https://www.youtube.com/watch?v=daefaLgNkw0"),
                        ("Strings and String Formatting", "https://www.youtube.com/watch?v=k9TUPpGqYTo"),
                    ],
                },
                {
                    "order": 4,
                    "title": "Functions and Modules",
                    "lessons": [
                        ("Defining and Calling Functions", "https://www.youtube.com/watch?v=9Os0o3wzS_I"),
                        ("Function Parameters and Return Values", "https://www.youtube.com/watch?v=nsZ8XqHPjI4"),
                        ("Importing and Using Modules", "https://www.youtube.com/watch?v=CqvZ3vGoGs0"),
                    ],
                },
                {
                    "order": 5,
                    "title": "Object-Oriented Programming",
                    "lessons": [
                        ("What is OOP?", "https://www.youtube.com/watch?v=Ej_02ICOIgs"),
                        ("Classes and Objects", "https://www.youtube.com/watch?v=apACNr7DC_s"),
                        ("Inheritance and Polymorphism", "https://www.youtube.com/watch?v=RSl87lqOXDE"),
                    ],
                },
                {
                    "order": 6,
                    "title": "Projects and Practice",
                    "lessons": [
                        ("Building a Simple Calculator", "https://www.youtube.com/watch?v=mg9yi6YuYkU"),
                        ("Creating a To-Do List App", "https://www.youtube.com/watch?v=BSaAMQVq01E"),
                        ("Next Steps in Programming", "https://www.youtube.com/watch?v=8PopR3x-VMY"),
                    ],
                },
            ]
        },
        "marketing": {
            "title": "Marketing Mastery",
            "description": "Learn marketing strategies from basics to advanced digital campaigns.",
            "images": [
                'marketing1.jpg',
                'marketing2.jpg',
                'marketing3.jpg',
            ],
            "stages": [
                {
                    "order": 1,
                    "title": "Introduction to Marketing",
                    "lessons": [
                        ("What is Marketing?", "https://www.youtube.com/watch?v=O9j9aLo9waY"),
                        ("The Marketing Mix", "https://www.youtube.com/watch?v=Mco8vBAwOmA"),
                        ("Consumer Behavior", "https://www.youtube.com/watch?v=yv2cp1fmSt0"),
                    ],
                },
                {
                    "order": 2,
                    "title": "Market Research and Analysis",
                    "lessons": [
                        ("Types of Market Research", "https://www.youtube.com/watch?v=a9wa1-_2R9E"),
                        ("Conducting Surveys and Focus Groups", "https://www.youtube.com/watch?v=TDWFTR-bGLM"),
                        ("Analyzing Market Trends", "https://www.youtube.com/watch?v=n27NLTeqxUQ"),
                    ],
                },
                {
                    "order": 3,
                    "title": "Branding and Positioning",
                    "lessons": [
                        ("Building a Strong Brand", "https://www.youtube.com/watch?v=0Yd3Y4mp1Qc"),
                        ("Brand Positioning Strategies", "https://www.youtube.com/watch?v=Rcv-J6534oE"),
                        ("Brand Communication", "https://www.youtube.com/watch?v=oSflXxUEWWw"),
                    ],
                },
                {
                    "order": 4,
                    "title": "Digital Marketing",
                    "lessons": [
                        ("Introduction to Digital Marketing", "https://www.youtube.com/watch?v=aC-DwwgqG6A"),
                        ("Search Engine Optimization (SEO)", "https://www.youtube.com/watch?v=MYE6T_gd7H0"),
                        ("Social Media Marketing", "https://www.youtube.com/watch?v=I2pwcAVonKI"),
                    ],
                },
                {
                    "order": 5,
                    "title": "Customer Relationship Management (CRM)",
                    "lessons": [
                        ("Importance of CRM", "https://www.youtube.com/watch?v=SlhESAKF1Tk"),
                        ("CRM Tools and Technologies", "https://www.youtube.com/watch?v=sQD7kaZ5h0s"),
                        ("Customer Retention Strategies", "https://www.youtube.com/watch?v=Y6IBkNNkfJg"),
                    ],
                },
                {
                    "order": 6,
                    "title": "Marketing Analytics and Metrics",
                    "lessons": [
                        ("Key Performance Indicators (KPIs)", "https://www.youtube.com/watch?v=soiChkomKmo"),
                        ("Data Analysis Techniques", "https://www.youtube.com/watch?v=lgCNTuLBMK4"),
                        ("Marketing ROI", "https://www.youtube.com/watch?v=1vRx5TYTmYs"),
                    ],
                },
            ]
        }
    }


def video_block(url: str) -> dict:
    return {"type": "video", "id": uuid.uuid4().hex, "url": url, "caption": ""}


def seed(db: Session) -> int:
    """Create the demo courses unless any course exists. Returns how many were created."""
    if db.scalar(select(Course.id).limit(1)) is not None:
        return 0

    courses = get_course_data()
    for key, info in courses.items():
        lesson_count, minutes = course_totals(
            [[video_block("")] for stage in info["stages"] for _ in stage["lessons"]]
        )
        db.add(
            Course(
                title=info["title"],
                description=info["description"],
                author=None,  # shown as "EduHub"
                status="published",
                published_at=func.now(),
                category=key,  # the demo set is keyed by its category
                level="beginner",
                lesson_count=lesson_count,
                estimated_minutes=minutes,
                images=[CourseImage(image=image) for image in info["images"]],
                stages=[
                    Stage(
                        title=stage["title"],
                        order=stage["order"],
                        lessons=[
                            Lesson(title=title, order=i, blocks=[video_block(url)])
                            for i, (title, url) in enumerate(stage["lessons"], 1)
                        ],
                    )
                    for stage in info["stages"]
                ],
            )
        )
    db.commit()
    return len(courses)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not get_settings().enable_populate_db:
        logger.info("Population disabled (ENABLE_POPULATE_DB is not true).")
        return
    with SessionLocal() as db:
        created = seed(db)
    if created:
        logger.info("Seeded %d demo courses.", created)
    else:
        logger.info("Courses already exist; nothing seeded.")


if __name__ == "__main__":
    main()
