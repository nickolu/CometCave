type Listener<T extends unknown[]> = (...args: T) => void

function createEmitter<T extends unknown[]>() {
  const listeners = new Set<Listener<T>>()
  return {
    emit: (...args: T) => listeners.forEach(fn => fn(...args)),
    subscribe: (fn: Listener<T>) => { listeners.add(fn); return () => listeners.delete(fn) },
  }
}

const longPressStart = createEmitter<[x: number, y: number]>()
const longPressCancel = createEmitter<[]>()
const tapRipple = createEmitter<[x: number, y: number]>()

export const emitLongPressStart = (x: number, y: number) => longPressStart.emit(x, y)
export const emitLongPressCancel = () => longPressCancel.emit()
export const emitTapRipple = (x: number, y: number) => tapRipple.emit(x, y)
export const onLongPressStart = (fn: (x: number, y: number) => void) => longPressStart.subscribe(fn)
export const onLongPressCancel = (fn: () => void) => longPressCancel.subscribe(fn)
export const onTapRipple = (fn: (x: number, y: number) => void) => tapRipple.subscribe(fn)
