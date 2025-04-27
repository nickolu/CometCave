export interface Item {
  id: string;
  name: string;
  description: string;
  quantity: number;
  // All fields strictly typed; no implicit any or this
}
