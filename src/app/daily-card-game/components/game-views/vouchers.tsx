import { Voucher } from '@/app/daily-card-game/components/shop/voucher'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { implementedVouchers, vouchers } from '@/app/daily-card-game/domain/voucher/vouchers'
import { Button } from '@/components/ui/button'

export const VouchersView = () => {
  return (
    <div className="flex flex-col items-center mt-10 h-screen w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Vouchers</h1>
      <div className="flex flex-wrap justify-center gap-2 mt-4 mx-auto">
        {Object.values(vouchers)
          .filter(voucher => implementedVouchers.includes(voucher.type))
          .map(voucher => (
            <Voucher key={voucher.type} voucher={voucher.type} />
          ))}
      </div>
      <Button
        className="mt-4"
        onClick={() => {
          eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })
        }}
      >
        Back to Main Menu
      </Button>
    </div>
  )
}
