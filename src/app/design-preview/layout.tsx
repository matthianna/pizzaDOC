import type { Metadata } from 'next'
import { DesignPreviewRoot } from '@/components/design-preview/design-preview-root'

export const metadata: Metadata = {
  title: 'Anteprima design — Pizza D.O.C.',
  description: 'Confronto restyling UI PizzaDOC: Fornace, Linea, Brace',
  robots: { index: false, follow: false },
}

export default function DesignPreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap"
        rel="stylesheet"
      />
      <DesignPreviewRoot>{children}</DesignPreviewRoot>
    </>
  )
}
