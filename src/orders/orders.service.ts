import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './order.schema';
import { Product, ProductDocument } from '../products/product.schema';

export interface CreateOrderDto {
  userId: string;
  productId: string;
  qty: number;
}

const ORDER_NUMBER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Isolated order-number generator.
 *
 * Format: ORD-<epoch-ms>-<4 random alphanumerics>. The random suffix is what
 * keeps concurrent orders unique within the same millisecond. The
 * `order-number` demo scenario "simplifies" this (e.g. drops the suffix),
 * producing duplicate order numbers that violate the unique index. Do NOT
 * inline this logic anywhere else.
 */
export function generateOrderNumber(): string {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += ORDER_NUMBER_ALPHABET.charAt(
      Math.floor(Math.random() * ORDER_NUMBER_ALPHABET.length),
    );
  }
  return `ORD-${Date.now()}-${suffix}`;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  findAll() {
    return this.orderModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async create(dto: CreateOrderDto) {
    if (!Types.ObjectId.isValid(dto.productId)) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }
    if (!Types.ObjectId.isValid(dto.userId)) {
      throw new NotFoundException(`User ${dto.userId} not found`);
    }

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product) {
      throw new NotFoundException(`Product ${dto.productId} not found`);
    }

    const qty = dto.qty && dto.qty > 0 ? Math.floor(dto.qty) : 1;
    const total = product.priceCents * qty;

    const order = await this.orderModel.create({
      orderNumber: generateOrderNumber(),
      userId: new Types.ObjectId(dto.userId),
      total,
      status: 'created',
      createdAt: new Date(),
    });

    return order.toObject();
  }
}
