"use client";

import Link from "next/link";
import { Separator, buttonVariants } from "@heroui/react";
import { IconBrandGithub, IconBrandLinkedin, IconBrandUpwork } from "@tabler/icons-react";
import { useUserStore } from "@/store/store";

const LINKEDIN_URL = "https://www.linkedin.com/in/bohdan-matvieiev-061827392/";
const GITHUB_URL = "https://github.com/bohdan-m";
const UPWORK_URL = "https://www.upwork.com/freelancers/~019dfaddf625a49656";

function Footer() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated());

  return (
    <footer className="mt-16 border-t border-separator pt-10 pb-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <section className="flex flex-col items-center gap-2">
          {isAuthenticated ? (
            <>
              <h3 className="m-0 text-xl font-semibold">Keep learning</h3>
              <p className="m-0 max-w-xs text-[15px] text-muted">
                Explore new courses and continue your journey with EduHub.
              </p>
              <Link className={buttonVariants({ className: "mt-2" })} href="/home">
                Browse courses
              </Link>
            </>
          ) : (
            <>
              <h3 className="m-0 text-xl font-semibold">Ready to start learning?</h3>
              <p className="m-0 max-w-xs text-[15px] text-muted">
                Join EduHub and access courses designed to help you grow.
              </p>
              <Link className={buttonVariants({ className: "mt-2" })} href="/register">
                Get started
              </Link>
            </>
          )}
        </section>

        <Separator className="max-w-48" />

        <section className="flex flex-col items-center gap-2">
          <span className="text-sm text-muted">Connect with the creator</span>
          <div className="flex gap-2">
            <a
              href={LINKEDIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", isIconOnly: true, className: "size-11 text-muted hover:text-foreground" })}
              aria-label="LinkedIn profile"
            >
              <IconBrandLinkedin size={20} aria-hidden />
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", isIconOnly: true, className: "size-11 text-muted hover:text-foreground" })}
              aria-label="GitHub profile"
            >
              <IconBrandGithub size={20} aria-hidden />
            </a>
            <a
              href={UPWORK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "ghost", isIconOnly: true, className: "size-11 text-muted hover:text-foreground" })}
              aria-label="Upwork profile"
            >
              <IconBrandUpwork size={20} aria-hidden />
            </a>
          </div>
        </section>

        <p className="text-[13px] text-muted">© {new Date().getFullYear()} EduHub. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;
