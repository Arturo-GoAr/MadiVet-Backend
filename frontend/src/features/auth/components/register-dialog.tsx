"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useT } from "@/shared/i18n";
import { fieldClass, labelClass, primaryButtonClass } from "./field-styles";

export function RegisterDialog() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (data.get("password") !== data.get("confirmPassword")) {
      setError(t.auth.passwordMismatch);
      return;
    }
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("fullName"),
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      const payload = (await response.json()) as { codigo?: string };

      if (!response.ok) {
        setError(
          payload.codigo === "SCHEMA_NOT_READY"
            ? t.common.schemaNotReady
            : payload.codigo === "EMAIL_EXISTS"
              ? t.auth.accountExists
              : payload.codigo === "BACKEND_UNAVAILABLE" ||
                  payload.codigo === "DATABASE_UNAVAILABLE"
                ? t.auth.connectionError
                : t.auth.registerFailed,
        );
        return;
      }

      toast.success(t.auth.accountCreated);
      setOpen(false);
    } catch (requestError) {
      console.error("Error registrando la cuenta:", requestError);
      setError(t.auth.connectionError);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button type="button" className="text-vet-link underline" />
        }
      >
        {t.auth.signUp}
      </DialogTrigger>
      <DialogContent className="max-w-[535px] gap-0 rounded-2xl bg-white px-[44px] py-[40px] ring-0 shadow-[0_4px_4px_rgba(0,0,0,0.25)] sm:max-w-[535px]">
        <DialogHeader className="items-center">
          <DialogTitle className="font-arvo text-[48px] font-normal leading-tight text-black">
            {t.auth.registerTitle}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="mt-8 grid gap-[18px]">
          <div className="grid gap-1.5">
            <Label htmlFor="fullName" className={labelClass}>
              {t.auth.fullName}
            </Label>
            <Input
              id="fullName"
              name="fullName"
              placeholder={t.auth.fullNamePlaceholder}
              autoComplete="name"
              required
              className={fieldClass}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reg-email" className={labelClass}>
              {t.common.email}
            </Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              placeholder={t.auth.emailPlaceholder}
              autoComplete="email"
              required
              className={fieldClass}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reg-password" className={labelClass}>
              {t.common.password}
            </Label>
            <Input
              id="reg-password"
              name="password"
              type="password"
              placeholder={t.auth.newPasswordPlaceholder}
              autoComplete="new-password"
              minLength={8}
              required
              className={fieldClass}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="confirmPassword" className={labelClass}>
              {t.auth.confirmPassword}
            </Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder={t.auth.newPasswordPlaceholder}
              autoComplete="new-password"
              required
              className={fieldClass}
            />
            {error && (
              <p role="alert" className="text-base text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" className={`${primaryButtonClass} mx-auto mt-2`}>
            {t.auth.register}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
