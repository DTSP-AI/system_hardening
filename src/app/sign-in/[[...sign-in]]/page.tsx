import { SignIn } from "@clerk/nextjs";
import { ArrowUpRight, BarChart3, MessageSquare, Users } from "lucide-react";
import { BrandMark } from "@/components/shell/brand-mark";

export default function SignInPage() {
  return <main className="signin-layout">
    <section className="signin-brand-panel">
      <div className="signin-brand"><BrandMark className="h-12 w-12"/><span>YBRYX <small>CRM</small></span></div>
      <div className="signin-message"><h1>Better relationships.<br/><span>Stronger business.</span></h1><p>Your clients, conversations, and next steps. Connected.</p></div>
      <div className="signin-network" aria-hidden="true"><svg viewBox="0 0 800 300" preserveAspectRatio="none"><path d="M0 210 Q150 20 300 180 T800 110 M0 255 Q175 120 320 210 T800 80 M0 180 Q150 270 300 100 T800 200 M0 240 Q210 0 400 180 T800 50"/><g>{[[40,210],[190,160],[300,180],[400,120],[530,140],[670,90],[750,165]].map(([x,y])=><circle key={x} cx={x} cy={y} r="5"/>)}</g></svg></div>
      <div className="signin-promise"><span className="signin-icon"><BarChart3 size={27}/></span><div><strong>Your next opportunity<br/>starts here.</strong><p>Turn conversations into lasting relationships.</p></div><ArrowUpRight size={19}/></div>
      <div className="signin-benefits"><span><Users/>More meaningful clients</span><span><MessageSquare/>Smarter conversations</span><span><BarChart3/>Bigger opportunities</span></div>
    </section>
    <section className="signin-form-panel"><div className="signin-form-wrap"><div className="signin-heading"><h2>Welcome back</h2><p>Sign in to your YBRYX workspace.</p></div><SignIn path="/sign-in" appearance={{elements:{rootBox:"w-full",cardBox:"shadow-none w-full",card:"shadow-none border-0 bg-transparent p-0 w-full",header:"hidden",footer:"hidden",formButtonPrimary:"bg-blue-600 hover:bg-blue-700",socialButtonsBlockButton:"border border-slate-300"}}}/></div></section>
  </main>;
}
