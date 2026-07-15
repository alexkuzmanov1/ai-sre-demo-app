import { Controller, Get, Param } from '@nestjs/common';
import { UsersService, UserSummary } from './users.service';
import { User } from './user.schema';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/summary')
  getSummary(@Param('id') id: string): Promise<UserSummary> {
    return this.usersService.getSummary(id);
  }

  @Get('list')
  list(): Promise<User[]> {
    return this.usersService.list();
  }
}
