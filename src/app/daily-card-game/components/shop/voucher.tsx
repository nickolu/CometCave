import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import type { VoucherType } from '@/app/daily-card-game/domain/voucher/types'
import { vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'

export function Voucher({ voucher }: { voucher: VoucherType }) {
  return (
    <GameCard>
      <div className="px-1 h-full">
        <div>
          <h3 className="text-sm font-bold">{vouchers[voucher].name}</h3>
          <p className="text-xs text-muted-foreground">{vouchers[voucher].description}</p>
        </div>
      </div>
    </GameCard>
  )
}
