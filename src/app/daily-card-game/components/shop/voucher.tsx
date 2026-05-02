import { TokenCard } from '@/app/daily-card-game/components/cosmic/token-card'
import type { VoucherType } from '@/app/daily-card-game/domain/voucher/types'
import { vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'

export function Voucher({ voucher }: { voucher: VoucherType }) {
  const def = vouchers[voucher]
  return (
    <TokenCard
      title={def.name}
      description={def.description}
      glyph="❖"
      accent="var(--cc-gold)"
      size="sm"
    />
  )
}
