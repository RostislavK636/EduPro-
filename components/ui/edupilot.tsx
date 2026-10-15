"use client";
import { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";
import { Button } from "./button";
export function GlassCard({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("glass-card", className)} {...props} />;
}
export function GradientButton({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button className={clsx("button primary", className)} {...props} />;
}
export function AnimatedPage({ children }: { children: ReactNode }) {
  return <div className="animated-page">{children}</div>;
}
export function ToolPageLayout({
  title,
  description,
  form,
  result,
}: {
  title: string;
  description: string;
  form: ReactNode;
  result?: ReactNode;
}) {
  return (
    <AnimatedPage>
      <header className="page-heading">
        <span className="eyebrow">МАСТЕРСКАЯ МАТЕРИАЛОВ</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className="tool-layout">
        <GlassCard className="tool-form">{form}</GlassCard>
        {result}
      </div>
    </AnimatedPage>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
