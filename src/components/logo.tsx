import * as React from "react"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

/** A bookshelf — three books leaning on a shelf. "Librero" is Spanish for bookshelf. */
export function Logo({ size = 24, className, ...props }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="4" y="4" width="4" height="14" rx="1" />
      <rect x="9.5" y="7" width="4" height="11" rx="1" />
      <path d="M16.4 7.6l3.3 1 -2.6 9.1 -3.3 -1z" />
      <path d="M3 21h18" />
    </svg>
  )
}
