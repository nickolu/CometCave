import { Voucher } from '@/app/comet-cards/components/shop/voucher'
import type { VoucherType } from '@/app/comet-cards/domain/voucher/types'

export function Vouchers({ vouchers }: { vouchers: VoucherType[] }) {
  return (
    <div>
      {vouchers.map(voucher => (
        <Voucher key={voucher} voucher={voucher} />
      ))}
    </div>
  )
}
