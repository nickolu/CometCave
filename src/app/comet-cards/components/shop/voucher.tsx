import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import type { VoucherType } from '@/app/comet-cards/domain/voucher/types'
import { vouchers } from '@/app/comet-cards/domain/voucher/vouchers'

export function Voucher({ voucher }: { voucher: VoucherType }) {
  const def = vouchers[voucher]
  return (
    <TokenCard
      title={def.name}
      description={def.description}
      glyph="❖"
      accent="var(--cc-gold)"
      size="sm"
      typeLabel="Voucher"
    />
  )
}
