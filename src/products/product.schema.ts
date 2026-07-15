import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { COLLECTIONS } from '../config/collections';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ collection: COLLECTIONS.products })
export class Product {
  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: Number, required: true })
  priceCents: number;

  @Prop({ type: Number, required: true, default: 0 })
  stock: number;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
