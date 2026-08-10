import { ErrorPage } from "@/components/error-page"

export const metadata = { title: "Something went wrong — Librero" }

export default function InternalServerErrorPage() {
  return (
    <ErrorPage
      code="500"
      title="Something went wrong"
      message="Librero hit an unexpected error. Try again — if it keeps happening, check the server logs."
    />
  )
}
