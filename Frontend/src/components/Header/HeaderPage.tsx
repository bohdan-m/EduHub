"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Drawer, buttonVariants } from "@heroui/react";
import { IconMenu2, IconPlus, IconX } from "@tabler/icons-react";
import { authApi } from "@/api/auth.api";
import { useUserStore } from "@/store/store";
import Brand from "@/components/Brand";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
    { to: "/home", label: "Home" },
    { to: "/about", label: "About Us" },
    { to: "/pricing", label: "Pricing" },
    { to: "/contact", label: "Contact" },
];

const navClass = (isActive: boolean) =>
    buttonVariants({
        variant: isActive ? "secondary" : "ghost",
        size: "sm",
        className: isActive ? "text-foreground" : "text-muted hover:text-foreground",
    });

function HeaderPage() {
    const { user, isAuthenticated, logout } = useUserStore();
    const router = useRouter();
    const pathname = usePathname();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const closeMenu = () => setIsMobileMenuOpen(false);

    const handleLogout = () => {
        const refresh = user?.refresh;
        if (refresh) {
            authApi.logout(refresh).catch(() => {});
        }
        logout();
        closeMenu();
        router.push("/login");
    };

    const authActions = (fullWidth: boolean) => isAuthenticated() ? (
        <>
            {user?.role === "teacher" && (
                <Link className={buttonVariants({ variant: "primary", size: "sm", fullWidth })} href="/courses/create" onClick={closeMenu}>
                    <IconPlus size={16} aria-hidden />
                    Create course
                </Link>
            )}
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
                    {NAV_LINKS.map(({ to, label }) => (
                        <Link key={to} className={navClass(pathname === to)} href={to} aria-current={pathname === to ? "page" : undefined}>{label}</Link>
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
                                    {NAV_LINKS.map(({ to, label }) => (
                                        <Link
                                            key={to}
                                            className={`${navClass(pathname === to)} w-full justify-start`}
                                            href={to}
                                            aria-current={pathname === to ? "page" : undefined}
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
