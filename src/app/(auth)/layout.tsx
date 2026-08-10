import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in — Librero",
  description: "Sign in to your bookshelf",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="bg-background min-h-screen">{children}</div>;
}
