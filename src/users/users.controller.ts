import { Controller, Get, Param } from '@nestjs/common';
import { UsersService, UserSummary } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id/summary')
  getSummary(@Param('id') id: string): Promise<UserSummary> {
    return this.usersService.getSummary(id);
  }
}
