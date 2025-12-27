import { Voucher } from '@/app/daily-card-game/components/shop/voucher'
import type { VoucherType } from '@/app/daily-card-game/domain/voucher/types'

export function Vouchers({ vouchers }: { vouchers: VoucherType[] }) {
  return (
    <div>
      {vouchers.map(voucher => (
        <Voucher key={voucher} voucher={voucher} />
      ))}
    </div>
  )
}
