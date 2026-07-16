import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { Order, OrderDocument } from '../orders/order.schema';

export interface UserSummary {
  id: string;
  name: string;
  currency: string;
  orderCount: number;
  totalSpentCents: number;
}

// Resolve the user's preferred display currency.
export function resolveCurrency(user: Pick<User, 'preferences'>): string {
  return user.preferences!.currency;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

  async getSummary(id: string): Promise<UserSummary> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const orders = await this.orderModel
      .find({ userId: user._id })
      .lean()
      .exec();

    const totalSpentCents = orders.reduce(
      (sum, order) => sum + order.total,
      0,
    );

    return {
      id: String(user._id),
      name: user.name,
      currency: resolveCurrency(user),
      orderCount: orders.length,
      totalSpentCents,
    };
  }

  /** Return every user as stored — no summaries, no derived fields. */
  list(): Promise<User[]> {
    return this.userModel.find().lean<User[]>().exec();
  }
}
