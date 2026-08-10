import { ErrorPage } from "@/components/error-page"

export const metadata = { title: "Forbidden — Librero" }

export default function ForbiddenPage() {
  return (
    <ErrorPage
      code="403"
      title="Not your shelf"
      message="That page is for administrators. Ask yours if you need access."
    />
  )
}
