import { type FormEvent, useState } from "react";
import { Navigate } from "react-router";
import { LogIn, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/useAuth";

export function LoginPage() {
  const { user, login } = useAuth();
  const [loginValue, setLoginValue] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(loginValue, password);
    } catch {
      setError("Neplatne prihlasovacie udaje");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgba(10,10,10,0.7)] backdrop-blur-[8px] px-4">
      <div className="relative w-[400px] rounded-2xl bg-white shadow-[0px_20px_24px_-4px_rgba(0,0,0,0.1),0px_8px_8px_-4px_rgba(0,0,0,0.04)]">
        {/* Close button */}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-lg p-2.5 text-[#737373] hover:bg-[#f5f5f5] transition-colors"
          aria-label="Zavrieť"
        >
          <X size={24} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center pt-6 px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-[#e5e5e5] shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
            <LogIn size={24} className="text-[#171717]" />
          </div>
          <h1 className="mt-4 text-base font-semibold text-[#171717] text-center leading-6">
            Prihláste sa do svojho účtu
          </h1>
          <p className="mt-1 text-sm font-normal text-[#525252] text-center leading-5">
            Vitajte späť! Zadajte, prosím, svoje údaje.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-[#404040]">
                Login
              </Label>
              <Input
                type="text"
                placeholder="Zadajte svoj login"
                value={loginValue}
                onChange={(e) => setLoginValue(e.target.value)}
                required
                autoComplete="username"
                className="h-[44px] rounded-lg border-[#d4d4d4] px-3.5 text-base placeholder:text-[#737373] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-sm font-medium text-[#404040]">
                Heslo
              </Label>
              <Input
                type="password"
                placeholder="Zadajte svoje heslo"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-[44px] rounded-lg border-[#d4d4d4] px-3.5 text-base placeholder:text-[#737373] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-sm text-danger">{error}</p>
          )}

          <div className="pt-8 pb-6">
            <Button
              type="submit"
              className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-base rounded-lg h-[44px] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Potvrdzovanie..." : "Potvrdiť"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
