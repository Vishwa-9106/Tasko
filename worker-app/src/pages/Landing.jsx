import Navbar from "../components/landing/Navbar";
import HeroSection from "../components/landing/HeroSection";
import HowItWorks from "../components/landing/HowItWorks";
import ServicesGrid from "../components/landing/ServicesGrid";
import WhyJoin from "../components/landing/WhyJoin";
import TrustSection from "../components/landing/TrustSection";
import Testimonials from "../components/landing/Testimonials";
import CTASection from "../components/landing/CTASection";
import Footer from "../components/landing/Footer";

export default function LandingPage() {
  const workerId = localStorage.getItem("tasko_worker_id");
  const loginHref = workerId ? "/waiting" : "/login";

  return (
    <div className="worker-landing" id="top">
      <Navbar loginHref={loginHref} />
      <main className="worker-main">
        <HeroSection loginHref={loginHref} />
        <HowItWorks />
        <ServicesGrid />
        <WhyJoin />
        <TrustSection />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
