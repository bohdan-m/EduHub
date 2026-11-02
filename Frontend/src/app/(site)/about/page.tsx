"use client";

import DescriptionAbout from "@/components/Description/DescriptionAbout";
import DescriptionPage from "@/components/Description/DescriptionPage";
import { Card } from "@heroui/react";
import { IconAward, IconBackpack, IconBook, IconBulb, IconCrown, IconHeartHandshake, IconPuzzle, IconThumbUp } from "@tabler/icons-react";

const GOALS = [
  {
    title: "Foster Creative Problem-Solving",
    description:
      "We encourage creative thinking and problem-solving abilities, allowing our students to tackle real-world challenges with confidence and innovation.",
    Icon: IconBook,
  },
  {
    title: "Promote Collaboration and Community",
    description:
      "We believe in the power of collaboration and peer learning. Our platform fosters a supportive and inclusive community where learners can connect, share insights, and grow together.",
    Icon: IconPuzzle,
  },
  {
    title: "Provide Practical Skills",
    description:
      "We focus on delivering practical skills that are relevant to the current industry demands. Our courses are designed to equip learners with the knowledge and tools needed to excel in their chosen field.",
    Icon: IconBackpack,
  },
  {
    title: "Stay Ahead of the Curve",
    description:
      "The digital landscape is constantly evolving, and we strive to stay at the forefront of industry trends. We regularly update our course content to ensure our students receive the latest knowledge and skills.",
    Icon: IconBulb,
  },
] as const;

const ACHIEVEMENTS = [
  {
    title: "Trusted by Thousands",
    description:
      "We have successfully served thousands of students from the whole world, helping them unlock their potential and achieve their career goals.",
    Icon: IconCrown,
  },
  {
    title: "Positive Student Feedback",
    description:
      "We take pride in the positive feedback we receive from our students, who appreciate the practicality and relevance of our course materials.",
    Icon: IconThumbUp,
  },
  {
    title: "Award-Winning Courses",
    description:
      "Our courses have received recognition and accolades in the industry for their quality, depth of content, and effective teaching methodologies.",
    Icon: IconAward,
  },
  {
    title: "Industry Partnerships",
    description:
      "We have established strong partnerships with industry leaders, enabling us to provide our students with access to the latest tools and technologies.",
    Icon: IconHeartHandshake,
  },
] as const;

function About() {
  return (
    <div className="pb-4">
      <DescriptionPage
        header="About EduHub"
        description="Welcome to EduHub, a full-stack educational platform built to demonstrate modern web development and real-world learning workflows. Our mission is to showcase how teachers can create and manage courses while students can easily discover, follow, and complete lessons."
      />

      <DescriptionAbout
        header="Achievements"
        description="Our commitment to excellence has led us to achieve significant milestones along our journey. Here are some of our notable achievements."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {ACHIEVEMENTS.map(({ title, description, Icon }) => (
          <Card key={title} className="gap-2 p-5 sm:p-6">
            <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
              <Icon size={22} aria-hidden />
            </span>
            <Card.Title className="m-0 text-[17px] font-semibold">{title}</Card.Title>
            <Card.Description className="m-0 text-[15px] text-muted">{description}</Card.Description>
          </Card>
        ))}
      </div>

      <DescriptionAbout
        header="Our Goals"
        description="At EduHub, our goal is to empower individuals from all backgrounds to thrive in the world of design and development. We believe that education should be accessible and transformative, enabling learners to pursue their passions and make a meaningful impact.
Through our carefully crafted courses, we aim to:"
      />
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {GOALS.map(({ title, description, Icon }) => (
          <Card key={title} className="gap-2 p-5 sm:p-6">
            <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground">
              <Icon size={22} aria-hidden />
            </span>
            <Card.Title className="m-0 text-[17px] font-semibold">{title}</Card.Title>
            <Card.Description className="m-0 text-[15px] text-muted">{description}</Card.Description>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default About;
