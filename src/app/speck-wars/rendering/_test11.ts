import { Application } from 'pixi.js'
type A = InstanceType<typeof Application>
type Keys = keyof A
declare const k: Keys
