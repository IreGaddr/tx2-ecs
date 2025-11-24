import { Component, ComponentId, defineComponent } from '../../../src/core/component.ts';
import { Signal } from '../../../src/reactive/signal.ts';

export interface ProductData {
  slug: string;
  name: string;
  price: number;
  description: string;
  image: string;
  tags: string[];
  badge?: string;
  rating: number;
  stock: number;
}

export class ProductComponent extends Component {
  static readonly componentId = 'Product' as ComponentId;
  static readonly componentName = 'Product';

  private slugSignal: Signal<string>;
  private nameSignal: Signal<string>;
  private priceSignal: Signal<number>;
  private descriptionSignal: Signal<string>;
  private imageSignal: Signal<string>;
  private tagsSignal: Signal<string[]>;
  private badgeSignal: Signal<string | undefined>;
  private ratingSignal: Signal<number>;
  private stockSignal: Signal<number>;

  constructor(data?: Partial<ProductData>) {
    super();
    this.slugSignal = this.defineReactive('slug', data?.slug ?? '');
    this.nameSignal = this.defineReactive('name', data?.name ?? '');
    this.priceSignal = this.defineReactive('price', data?.price ?? 0);
    this.descriptionSignal = this.defineReactive('description', data?.description ?? '');
    this.imageSignal = this.defineReactive('image', data?.image ?? '');
    this.tagsSignal = this.defineReactive('tags', data?.tags ?? []);
    this.badgeSignal = this.defineReactive('badge', data?.badge);
    this.ratingSignal = this.defineReactive('rating', data?.rating ?? 0);
    this.stockSignal = this.defineReactive('stock', data?.stock ?? 0);
  }

  get slug(): string {
    return this.slugSignal.get();
  }
  set slug(value: string) {
    this.slugSignal.set(value);
  }

  get name(): string {
    return this.nameSignal.get();
  }
  set name(value: string) {
    this.nameSignal.set(value);
  }

  get price(): number {
    return this.priceSignal.get();
  }
  set price(value: number) {
    this.priceSignal.set(value);
  }

  get description(): string {
    return this.descriptionSignal.get();
  }
  set description(value: string) {
    this.descriptionSignal.set(value);
  }

  get image(): string {
    return this.imageSignal.get();
  }
  set image(value: string) {
    this.imageSignal.set(value);
  }

  get tags(): string[] {
    return this.tagsSignal.get();
  }
  set tags(value: string[]) {
    this.tagsSignal.set(value);
  }

  get badge(): string | undefined {
    return this.badgeSignal.get();
  }
  set badge(value: string | undefined) {
    this.badgeSignal.set(value);
  }

  get rating(): number {
    return this.ratingSignal.get();
  }
  set rating(value: number) {
    this.ratingSignal.set(value);
  }

  get stock(): number {
    return this.stockSignal.get();
  }
  set stock(value: number) {
    this.stockSignal.set(value);
  }

  clone(): this {
    return new ProductComponent({
      slug: this.slugSignal.peek(),
      name: this.nameSignal.peek(),
      price: this.priceSignal.peek(),
      description: this.descriptionSignal.peek(),
      image: this.imageSignal.peek(),
      tags: [...this.tagsSignal.peek()],
      badge: this.badgeSignal.peek(),
      rating: this.ratingSignal.peek(),
      stock: this.stockSignal.peek(),
    }) as this;
  }
}

export const Product = defineComponent('Product', () => ProductComponent);
