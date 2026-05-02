import { ReferenceView } from '@/app/daily-card-game/components/cosmic/reference-view'
import { Voucher } from '@/app/daily-card-game/components/shop/voucher'
import { implementedVouchers, vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'

export const VouchersView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Vouchers"
      description="Permanent run-wide perks. Buy from the shop; effects persist until the run ends."
    >
      <div className="flex flex-wrap gap-3">
        {Object.values(vouchers)
          .filter(voucher => implementedVouchers.includes(voucher.type))
          .map(voucher => (
            <Voucher key={voucher.type} voucher={voucher.type} />
          ))}
      </div>
    </ReferenceView>
  )
}
