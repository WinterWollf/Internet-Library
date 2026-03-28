// [v0 import] Component: HomePage
// Location: frontend/app/page.tsx
// Connect to: N/A — assembles section components, each connects to its own endpoint
// Mock data: none (delegated to section components)
// Auth: public
// TODO: none — shell only
import Navbar from "@/components/navbar";
import Hero from "@/components/hero";
import FeaturedBooks from "@/components/books/featured-books";
import HowItWorks from "@/components/how-it-works";
import Footer from "@/components/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background font-sans flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <FeaturedBooks />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
