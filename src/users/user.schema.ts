import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { COLLECTIONS } from '../config/collections';

export interface UserPreferences {
  currency: string;
  locale: string;
}

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: COLLECTIONS.users })
export class User {
  @Prop({ type: String, required: true })
  email: string;

  @Prop({ type: String, required: true })
  name: string;

  // Nullable object — new users have no preferences yet (default null).
  @Prop({ type: Object, default: null })
  preferences: UserPreferences | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
