"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@heroui/react";
import { IconMoon, IconSun } from "@tabler/icons-react";

// The root layout's inline script sets the `dark` class before first paint; this reads and flips it.
const subscribe = (onChange: () => void) => {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
};
const isDarkNow = () => document.documentElement.classList.contains("dark");

function ThemeToggle() {
    // server render assumes light; React re-renders with the real value right after hydration
    const isDark = useSyncExternalStore(subscribe, isDarkNow, () => false);

    const toggle = () => {
        const next = !isDark;
        document.documentElement.classList.toggle("dark", next);
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#141816" : "#F6F5F0");
        try {
            localStorage.setItem("theme", next ? "dark" : "light");
        } catch {
            // private mode: the choice just isn't remembered
        }
    };

    return (
        <Button
            variant="ghost"
            size="sm"
            isIconOnly
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onPress={toggle}
        >
            {isDark ? <IconSun size={18} aria-hidden /> : <IconMoon size={18} aria-hidden />}
        </Button>
    );
}

export default ThemeToggle;
