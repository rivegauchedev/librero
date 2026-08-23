import { Inter, Newsreader } from 'next/font/google'

// Configure Inter font to match exactly what Next.js optimizes for
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

/*
 * The bookish half of the pairing. Newsreader carries the headings, book titles
 * and anything quoted from the shelf itself; Inter stays on the controls, so the
 * chrome reads as software and the catalogue reads as a library card.
 */
export const newsreader = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  style: ['normal', 'italic'],
  weight: ['400', '500', '600'],
  variable: '--font-newsreader',
})
