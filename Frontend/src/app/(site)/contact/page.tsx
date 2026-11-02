"use client";

import { Button, Card, FieldError, Form, Input, Label, TextArea, TextField } from "@heroui/react";
import { IconMail, IconMapPin, IconPhone, type TablerIcon } from "@tabler/icons-react";
import DescriptionPage from "@/components/Description/DescriptionPage";

// Tinted tile behind each contact detail's icon
const IconTile = ({ icon: Icon }: { icon: TablerIcon }) => (
  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-soft-foreground" aria-hidden>
    <Icon size={18} />
  </span>
);

const CONTACT_EMAIL = "bohdanmatvieiev1@gmail.com";
const CONTACT_PHONE = "+91 00000 00000";
const CONTACT_LOCATION = "The Czech Republic";

function Contact() {
  // shortcut: no contact endpoint on the backend, so the form hands off to the visitor's mail app
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    const body = [
      field("message"),
      "",
      `${field("firstName")} ${field("lastName")}`.trim(),
      field("email"),
      field("phone"),
    ].filter((line, i) => i < 2 || line).join("\n");
    const subject = field("subject") || "Message from EduHub";
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="pb-4">
      <DescriptionPage
        header="Contact Us"
        description="Welcome to EduHub's Contact page, where you can get in touch with our team for support, feedback, or partnership inquiries. Whether you have questions about courses, platform features, or technical details, we are here to help. Reach out to us and let us know how we can support your experience with EduHub."
      />
      <div className="mt-10 grid items-start gap-6 md:grid-cols-[1fr_minmax(260px,340px)]">
        <Card className="p-5 sm:p-7">
          <Card.Header>
            <Card.Title className="m-0 text-xl font-semibold">Send us a message</Card.Title>
          </Card.Header>
          <Form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="firstName" autoComplete="given-name" isRequired fullWidth>
              <Label>First Name</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField name="lastName" autoComplete="family-name" isRequired fullWidth>
              <Label>Last Name</Label>
              <Input />
              <FieldError />
            </TextField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
            <TextField name="email" type="email" autoComplete="email" isRequired fullWidth>
              <Label>Email</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField name="phone" type="tel" autoComplete="tel" fullWidth>
              <Label>Phone</Label>
              <Input />
              <FieldError />
            </TextField>
            </div>
            <TextField name="subject" fullWidth>
              <Label>Subject</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField name="message" isRequired fullWidth>
              <Label>Message</Label>
              <TextArea rows={5} className="min-h-36" />
              <FieldError />
            </TextField>
            <Button type="submit" size="lg" className="mt-1 w-full sm:w-auto sm:self-start">
              Send message
            </Button>
          </Form>
        </Card>

        <aside className="flex flex-col gap-3" aria-label="Contact information">
          <Card className="flex-row items-center gap-3 px-5 py-4">
            <IconTile icon={IconMail} />
            <a className="min-w-0 text-[15px] text-foreground [overflow-wrap:anywhere] hover:text-accent" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </Card>
          <Card className="flex-row items-center gap-3 px-5 py-4">
            <IconTile icon={IconPhone} />
            <a className="text-[15px] text-foreground hover:text-accent" href={`tel:${CONTACT_PHONE.replace(/\s/g, "")}`}>{CONTACT_PHONE}</a>
          </Card>
          <Card className="flex-row items-center gap-3 px-5 py-4">
            <IconTile icon={IconMapPin} />
            <p className="m-0 text-[15px]">{CONTACT_LOCATION}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default Contact;
