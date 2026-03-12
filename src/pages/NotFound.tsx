import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Shield } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(222,30%,7%)]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-5">
          <Shield className="w-7 h-7 text-cyan-400" />
        </div>
        <div className="text-6xl font-bold text-slate-600 font-mono mb-3">404</div>
        <p className="text-slate-400 mb-6">This route does not exist in the system</p>
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/25 transition-colors"
        >
          Return to Dashboard
        </a>
      </div>
    </div>
  );
};

export default NotFound;
