import { Footer } from "@/components/zozio/footer";
import { Navbar } from "@/components/zozio/navbar";
import { TestingBanner } from "@/components/zozio/testing-banner";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TestingBanner />
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
