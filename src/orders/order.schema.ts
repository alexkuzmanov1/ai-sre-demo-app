import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { COLLECTIONS } from '../config/collections';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ collection: COLLECTIONS.orders })
export class Order {
  // Unique index is MANDATORY — this is what the `order-number` scenario
  // violates once generateOrderNumber() is "simplified" into collisions.
  @Prop({ type: String, required: true, unique: true })
  orderNumber: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true })
  total: number;

  @Prop({ type: String, required: true, default: 'created' })
  status: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
