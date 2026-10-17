import SiteShell from '@/components/site/SiteShell'
import UnsubscribeForm from '@/components/site/UnsubscribeForm'

export const metadata = { title: 'Hủy đăng ký nhận email', robots: { index: false, follow: false } }

export default function UnsubscribePage() {
  return (
    <SiteShell>
      <h1 className="text-3xl font-bold">Hủy đăng ký nhận email</h1>
      <UnsubscribeForm />
    </SiteShell>
  )
}
