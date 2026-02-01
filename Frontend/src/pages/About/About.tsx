import DescriptionAbout from "../../components/Description/DescriptionAbout";
import DescriptionPage from "../../components/Description/DescriptionPage";
import styles from "./About.module.css";

/* Free icons via URL (Iconify API – Material Design Icons) */
const ICON_BASE = "https://api.iconify.design/mdi";
const iconUrl = (name: string) => `${ICON_BASE}/${name}.svg?height=40&iconColor=ff9500`;

const GOALS = [
  {
    title: "Foster Creative Problem-Solving",
    description:
      "We encourage creative thinking and problem-solving abilities, allowing our students to tackle real-world challenges with confidence and innovation.",
    iconUrl: iconUrl("book-open-variant"),
  },
  {
    title: "Promote Collaboration and Community",
    description:
      "We believe in the power of collaboration and peer learning. Our platform fosters a supportive and inclusive community where learners can connect, share insights, and grow together.",
    iconUrl: iconUrl("puzzle"),
  },
  {
    title: "Provide Practical Skills",
    description:
      "We focus on delivering practical skills that are relevant to the current industry demands. Our courses are designed to equip learners with the knowledge and tools needed to excel in their chosen field.",
    iconUrl: iconUrl("backpack"),
  },
  {
    title: "Stay Ahead of the Curve",
    description:
      "The digital landscape is constantly evolving, and we strive to stay at the forefront of industry trends. We regularly update our course content to ensure our students receive the latest knowledge and skills.",
    iconUrl: iconUrl("lightbulb-on"),
  },
] as const;

const ACHIEVEMENTS = [
  {
    title: "Trusted by Thousands",
    description:
      "We have successfully served thousands of students from the whole world, helping them unlock their potential and achieve their career goals.",
    iconUrl: iconUrl("crown"),
  },
  {
    title: "Positive Student Feedback",
    description:
      "We take pride in the positive feedback we receive from our students, who appreciate the practicality and relevance of our course materials.",
    iconUrl: iconUrl("drama-masks"),
  },
  {
    title: "Award-Winning Courses",
    description:
      "Our courses have received recognition and accolades in the industry for their quality, depth of content, and effective teaching methodologies.",
    iconUrl: iconUrl("medal"),
  },
  {
    title: "Industry Partnerships",
    description:
      "We have established strong partnerships with industry leaders, enabling us to provide our students with access to the latest tools and technologies.",
    iconUrl: iconUrl("shield-check"),
  },
] as const;

function About() {
  return (
    <div className={styles.wrapper}>
      <DescriptionPage
        header="About EduHub"
        description="Welcome to EduHub, a full-stack educational platform built to demonstrate modern web development and real-world learning workflows. Our mission is to showcase how teachers can create and manage courses while students can easily discover, follow, and complete lessons."
      />

      <DescriptionAbout
        header="Achievements"
        description="Our commitment to excellence has led us to achieve significant milestones along our journey. Here are some of our notable achievements."
      />
      <div className={styles.cardsWrap}>
        {ACHIEVEMENTS.map(({ title, description, iconUrl: url }) => (
          <article key={title} className={styles.card}>
            <div className={styles.iconWrap}>
              <span className={styles.iconInner}>
                <img src={url} alt="" width={40} height={40} className={styles.iconImg} />
              </span>
            </div>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardDesc}>{description}</p>
          </article>
        ))}
      </div>

      <DescriptionAbout
        header="Our Goals"
        description="At EduHub, our goal is to empower individuals from all backgrounds to thrive in the world of design and development. We believe that education should be accessible and transformative, enabling learners to pursue their passions and make a meaningful impact.
Through our carefully crafted courses, we aim to."
      />
      <div className={styles.cardsWrap}>
        {GOALS.map(({ title, description, iconUrl: url }) => (
          <article key={title} className={styles.card}>
            <div className={styles.iconWrap}>
              <span className={styles.iconInner}>
                <img src={url} alt="" width={40} height={40} className={styles.iconImg} />
              </span>
            </div>
            <h3 className={styles.cardTitle}>{title}</h3>
            <p className={styles.cardDesc}>{description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

export default About;
