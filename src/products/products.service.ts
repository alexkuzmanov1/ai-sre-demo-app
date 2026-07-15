import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type Redis from 'ioredis';
import { Model } from 'mongoose';
import { createRedisClient } from '../config/redis.config';
import { Product, ProductDocument } from './product.schema';

const CACHE_KEY = 'products:all';
const CACHE_TTL_SECONDS = 30;

@Injectable()
export class ProductsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ProductsService');
  private redis!: Redis;

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  onModuleInit(): void {
    // Redis connection settings come ONLY from src/config/redis.config.ts.
    this.redis = createRedisClient();
    // Handle connection 'error' events so an unreachable Redis doesn't crash
    // the process on emit. Command promises still reject (see findAll).
    this.redis.on('error', (err) => {
      this.logger.warn(`Redis connection error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) {
      await this.redis.quit().catch(() => undefined);
    }
  }

  async findAll(): Promise<Product[]> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      this.logger.log(`cache HIT ${CACHE_KEY}`);
      return JSON.parse(cached) as Product[];
    }

    this.logger.log(`cache MISS ${CACHE_KEY} -> reading MongoDB`);
    const products = await this.productModel.find().lean().exec();
    await this.redis.set(
      CACHE_KEY,
      JSON.stringify(products),
      'EX',
      CACHE_TTL_SECONDS,
    );
    return products as Product[];
  }
}
