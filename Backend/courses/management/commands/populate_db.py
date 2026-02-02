from django.core.management.base import BaseCommand
from django.db import transaction
from users.models import User
from courses.models import Course, CourseImage, Stage, Lesson
import os


def create_stage(course, order, title, lessons):
    """Create a stage with its lessons."""
    stage = Stage.objects.create(title=title, order=order, course=course)
    lesson_objects = [
        Lesson(title=lesson_title, url=url, order=i, stage=stage)
        for i, (lesson_title, url) in enumerate(lessons, start=1)
    ]
    Lesson.objects.bulk_create(lesson_objects)
    return stage


def create_course_with_stages(title, description, author, images, stages_data):
    """Create a course with images and stages."""
    course = Course.objects.create(
        title=title,
        description=description,
        author=author
    )
    
    CourseImage.objects.bulk_create([
        CourseImage(course=course, image=img) for img in images
    ])

    for stage_data in stages_data:
        create_stage(
            course=course,
            order=stage_data["order"],
            title=stage_data["title"],
            lessons=stage_data["lessons"]
        )
    
    return course


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
                        ("Operators and Expressions", "https://www.youtube.com/watch?v=GEMZpw7ug-k&list=PLBlnK6fEyqRjdKzSsGiBpr6fAxawT9WWb"),
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


class Command(BaseCommand):
    help = 'Populate database with initial courses and users'
    
    @transaction.atomic
    def handle(self, *args, **options):
        """Main function to populate the database."""
        if os.environ.get("ENABLE_POPULATE_DB", "false").lower() != "true":
            self.stdout.write("Population disabled.")
            return

        if Course.objects.exists():
            self.stdout.write(self.style.WARNING('Courses already exist. Skipping data population.'))
            return
        
        teacher = User.objects.create_user(
            username="teacher",
            email="teacher@gmail.com",
            password="1234", 
            role="teacher"
        )

        student = User.objects.create_user(
            username="student",
            email="student@gmail.com",
            password="1234",  
            role="student"
        )

        courses_data = get_course_data()
        
        for course_key, course_info in courses_data.items():
            create_course_with_stages(
                title=course_info["title"],
                description=course_info["description"],
                author=teacher,
                images=course_info["images"],
                stages_data=course_info["stages"]
            )
            self.stdout.write(self.style.SUCCESS(f"✓ {course_info['title']} created successfully!"))
