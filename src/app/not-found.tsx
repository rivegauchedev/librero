import { ErrorPage } from "@/components/error-page"

export default function NotFound() {
  return (
    <ErrorPage
      code="404"
      title="Nothing on this shelf"
      message="That page doesn't exist. It may have been renamed or removed."
    />
  )
}
