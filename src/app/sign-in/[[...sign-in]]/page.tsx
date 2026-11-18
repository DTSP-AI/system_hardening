import { SignIn } from "@clerk/nextjs";
import { ArrowUpRight, BarChart3, MessageSquare, Users } from "lucide-react";
import { SigninWave } from "@/components/shell/signin-wave";

export default function SignInPage() {
  return <main className="signin-layout">
    <SigninWave />
    <section className="signin-brand-panel">
      <div className="signin-brand"><span>YBRYX <small className="block mt-1">Business Operating Systems</small></span></div>
      <div className="signin-message"><h1 className="signin-headline"><span className="signin-headline-main"><strong>Business</strong> <span>Clarity</span></span></h1><p>Connect your people, processes, and data for a deeper view of your business—and the confidence to move it forward.</p></div>
      <div className="signin-promise"><span className="signin-icon"><BarChart3 size={27}/></span><div><strong>A clearer view of<br/>your business.</strong><p>Connected systems. Better decisions.</p></div><ArrowUpRight size={19}/></div>
      <div className="signin-benefits"><span><Users/>Connected data</span><span><MessageSquare/>Aligned teams</span><span><BarChart3/>Smarter decisions</span></div>
    </section>
    <section className="signin-form-panel"><div className="signin-form-wrap"><div className="signin-heading"><h2>Welcome back</h2><p>Sign in to your YBRYX workspace.</p></div><SignIn path="/sign-in" appearance={{variables:{colorPrimary:"#087ec2",colorBackground:"#ffffff",colorForeground:"#10233a",colorMutedForeground:"#66788c",colorInput:"#ffffff",colorInputForeground:"#10233a",colorNeutral:"#172b42",borderRadius:"0.5rem"},elements:{rootBox:"w-full",cardBox:"shadow-none w-full bg-transparent border-0",card:"shadow-none border-0 bg-transparent p-0 w-full",header:"hidden",footer:"hidden",formButtonPrimary:"bg-blue-600 hover:bg-blue-700",socialButtonsBlockButton:"border border-slate-300 text-slate-900",formFieldLabel:"text-slate-700",formFieldInput:"border border-slate-300 text-slate-900",dividerText:"text-slate-500",footerActionText:"text-slate-600",footerActionLink:"text-blue-700"}}}/></div></section>
  </main>;
}
