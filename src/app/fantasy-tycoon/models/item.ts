export interface Item {
  id: string;
  name: string;
  description: string;
  icon: string;
  quantity: number;
  // All fields strictly typed; no implicit any or this
}
