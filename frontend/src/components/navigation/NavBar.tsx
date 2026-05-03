import { useRouter } from 'next/router'
import { useState } from 'react'
import Image from 'next/image' // optional – you can use <img> if you prefer

export default function NavBar() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Appliances', href: '/appliances' },
    { label: 'Automation', href: '/automation' },
    { label: 'Advisor', href: '/advisor' },
    { label: 'Analytics', href: '/analytics' },
  ]

  const isActive = (href: string) => router.pathname === href

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          {/* Logo image – adjust height/width via CSS or inline */}
          <img
            src="/logo Ho-mee.png"
            alt="Ho-Mee Logo"
            className="navbar-logo-img"
            height={50}
            width={50}
          />
        </div>

        {/* Desktop Navigation */}
        <div className="navbar-links-desktop">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                router.push(link.href)
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Mobile Hamburger */}
        <button
          className="navbar-hamburger"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`} />
          <span className={`hamburger-line ${isMenuOpen ? 'open' : ''}`} />
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="navbar-links-mobile">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`nav-link-mobile ${isActive(link.href) ? 'active' : ''}`}
              onClick={(e) => {
                e.preventDefault()
                router.push(link.href)
                setIsMenuOpen(false)
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </nav>
  )
}