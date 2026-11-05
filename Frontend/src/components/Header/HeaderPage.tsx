"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Drawer, buttonVariants } from "@heroui/react";
import { IconMenu2, IconPlus, IconSettings, IconX } from "@tabler/icons-react";
import { apiToken } from "@/api/axios.config";
import { authClient } from "@/lib/auth-client";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
    { to: "/home", label: "Courses", signedIn: false },
    { to: "/learning", label: "My learning", signedIn: true },
    { to: "/teach", label: "Teach", signedIn: true },
    { to: "/about", label: "About", signedIn: false },
];

const navClass = (isActive: boolean) =>
    buttonVariants({
        variant: isActive ? "secondary" : "ghost",
        size: "sm",
        className: isActive ? "text-foreground" : "text-muted hover:text-foreground",
    });

function HeaderPage() {
    const { data: session } = authClient.useSession();
    const user = session?.user;
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const closeMenu = () => setIsMobileMenuOpen(false);
    const links = NAV_LINKS.filter((link) => !link.signedIn || user);
    const isActive = (to: string) => pathname === to || (to !== "/home" && pathname.startsWith(`${to}/`));

    const handleLogout = async () => {
        await authClient.signOut();
        apiToken.clear();
        closeMenu();
        router.push("/");
        router.refresh();
    };

    const authActions = (fullWidth: boolean) => user ? (
        <>
            <Link className={buttonVariants({ variant: "primary", size: "sm", fullWidth })} href="/courses/create" onClick={closeMenu}>
                <IconPlus size={16} aria-hidden />
                Create course
            </Link>
            <Link className={buttonVariants({ variant: "ghost", size: "sm", fullWidth })} href="/settings" onClick={closeMenu} aria-current={pathname === "/settings" ? "page" : undefined}>
                <IconSettings size={16} aria-hidden />
                Settings
            </Link>
            <Button variant="ghost" size="sm" fullWidth={fullWidth} onPress={handleLogout}>
                Log out
            </Button>
        </>
    ) : (
        <>
            <Link className={buttonVariants({ variant: "ghost", size: "sm", fullWidth })} href="/register" onClick={closeMenu}>
                Sign up
            </Link>
            <Link className={buttonVariants({ variant: "primary", size: "sm", fullWidth })} href="/login" onClick={closeMenu}>
                Log in
            </Link>
        </>
    );

    return (
        <header className="flex items-center justify-between gap-6 py-4">
            <nav className="flex items-center gap-8" aria-label="Main">
                <Brand />
                <div className="hidden gap-1 md:flex">
                    {links.map(({ to, label }) => (
                        <Link key={to} className={navClass(isActive(to))} href={to} aria-current={isActive(to) ? "page" : undefined}>{label}</Link>
                    ))}
                </div>
            </nav>

            <div className="flex items-center gap-2">
                <ThemeToggle />
                <div className="hidden items-center gap-2 md:flex">{authActions(false)}</div>

                <Drawer isOpen={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                    <Drawer.Trigger
                        className={buttonVariants({ variant: "ghost", isIconOnly: true, className: "md:hidden" })}
                        aria-label="Menu"
                    >
                        <IconMenu2 size={20} aria-hidden />
                    </Drawer.Trigger>
                    <Drawer.Backdrop>
                        <Drawer.Content placement="right">
                            <Drawer.Dialog aria-label="Menu" className="w-72 max-w-[85vw]">
                                <Drawer.Header>
                                    <Drawer.Heading className="text-base font-semibold">Menu</Drawer.Heading>
                                    <Drawer.CloseTrigger><IconX size={16} /></Drawer.CloseTrigger>
                                </Drawer.Header>
                                <Drawer.Body className="flex flex-col gap-1">
                                    {links.map(({ to, label }) => (
                                        <Link
                                            key={to}
                                            className={`${navClass(isActive(to))} w-full justify-start`}
                                            href={to}
                                            aria-current={isActive(to) ? "page" : undefined}
                                            onClick={closeMenu}
                                        >
                                            {label}
                                        </Link>
                                    ))}
                                    <div className="mt-3 flex flex-col gap-2 border-t border-separator pt-4">
                                        {authActions(true)}
                                    </div>
                                </Drawer.Body>
                            </Drawer.Dialog>
                        </Drawer.Content>
                    </Drawer.Backdrop>
                </Drawer>
            </div>
        </header>
    );
}

export default HeaderPage;
