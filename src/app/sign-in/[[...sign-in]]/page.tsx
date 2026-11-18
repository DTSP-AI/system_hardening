import { SignIn } from "@clerk/nextjs";
import { ArrowUpRight, BarChart3, MessageSquare, Users } from "lucide-react";

export default function SignInPage() {
  return <main className="signin-layout">
    <section className="signin-brand-panel">
      <div className="signin-brand"><span>YBRYX <small className="block mt-1">Business Operating System</small></span></div>
      <div className="signin-message"><h1>Better relationships.<br/><span>Stronger business.</span></h1><p>Your clients, conversations, and next steps. Connected.</p></div>
      <div className="signin-circuit" aria-hidden="true"><span className="signin-stars" /></div>
      <div className="signin-promise"><span className="signin-icon"><BarChart3 size={27}/></span><div><strong>Your next opportunity<br/>starts here.</strong><p>Turn conversations into lasting relationships.</p></div><ArrowUpRight size={19}/></div>
      <div className="signin-benefits"><span><Users/>More meaningful clients</span><span><MessageSquare/>Smarter conversations</span><span><BarChart3/>Bigger opportunities</span></div>
    </section>
    <section className="signin-form-panel"><div className="signin-form-wrap"><div className="signin-heading"><h2>Welcome back</h2><p>Sign in to your YBRYX workspace.</p></div><SignIn path="/sign-in" appearance={{variables:{colorPrimary:"#08b7e8",colorBackground:"#081321",colorForeground:"#eef6fc",colorMutedForeground:"#a9bed5",colorInput:"#0b1a2b",colorInputForeground:"#f0f6fc",colorNeutral:"#e3edf5",borderRadius:"0.5rem"},elements:{rootBox:"w-full",cardBox:"shadow-none w-full",card:"shadow-none border-0 bg-transparent p-0 w-full",header:"hidden",footer:"hidden",formButtonPrimary:"bg-blue-600 hover:bg-blue-700",socialButtonsBlockButton:"border border-slate-600 text-slate-100",formFieldLabel:"text-slate-200",formFieldInput:"border border-slate-600 text-white",dividerText:"text-slate-400",footerActionText:"text-slate-300",footerActionLink:"text-cyan-400"}}}/></div></section>
  </main>;
}
