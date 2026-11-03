import { CheckCircle2 } from "lucide-react";

const POINTS = [
  "Submit returns and warranty claims against your orders",
  "Follow every step with a clear timeline",
  "Talk to the support team in one place",
];

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-slate-900 p-10 lg:flex">
        <div
          className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative flex items-center gap-2.5">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <span className="text-xl font-semibold text-white">ReturnDesk</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl leading-tight font-semibold text-white">
            Returns and warranty claims, handled in one place.
          </h2>
          <ul className="mt-8 space-y-3">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3 text-slate-300">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-500">All accounts, orders and products are fictional demo data.</p>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="text-lg font-semibold text-slate-900">ReturnDesk</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
