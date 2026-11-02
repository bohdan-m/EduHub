import HeaderPage from "@/components/Header/HeaderPage";
import Footer from "@/components/Footer/Footer";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HeaderPage />
      <main className="flex flex-1 flex-col">{children}</main>
      <Footer />
    </>
  );
}
