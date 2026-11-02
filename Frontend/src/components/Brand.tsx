import Link from "next/link";
import Image from "next/image";
import logo from "@/images/logo.svg";

function Brand() {
    return (
        <Link href="/home" className="flex items-center gap-2.5 text-lg font-semibold text-foreground">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand">
                <Image className="size-5" src={logo} alt="" />
            </span>
            EduHub
        </Link>
    );
}

export default Brand;
