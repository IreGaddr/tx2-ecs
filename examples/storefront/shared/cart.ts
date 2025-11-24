import type { EntityId } from '../../../src/core/entity.ts';
import { Component, ComponentId, defineComponent } from '../../../src/core/component.ts';
import { Signal } from '../../../src/reactive/signal.ts';

export interface CartLine {
  productEntity: EntityId;
  quantity: number;
}

export class CartComponent extends Component {
  static readonly componentId = 'Cart' as ComponentId;
  static readonly componentName = 'Cart';

  private linesSignal: Signal<CartLine[]>;

  constructor(lines: CartLine[] = []) {
    super();
    this.linesSignal = this.defineReactive('lines', lines);
  }

  get lines(): CartLine[] {
    return this.linesSignal.get();
  }

  set lines(value: CartLine[]) {
    this.linesSignal.set(value);
  }

  upsert(productEntity: EntityId, quantity: number): void {
    const next = this.linesSignal.peek();
    const existing = next.find(line => line.productEntity === productEntity);
    if (existing) {
      existing.quantity = quantity;
      this.linesSignal.set([...next]);
    } else {
      this.linesSignal.set([...next, { productEntity, quantity }]);
    }
  }

  remove(productEntity: EntityId): void {
    const filtered = this.linesSignal.peek().filter(line => line.productEntity !== productEntity);
    this.linesSignal.set(filtered);
  }

  clear(): void {
    this.linesSignal.set([]);
  }

  clone(): this {
    return new CartComponent(this.linesSignal.peek().map(line => ({ ...line }))) as this;
  }
}

export const Cart = defineComponent('Cart', () => CartComponent);
