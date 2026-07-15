import { Controller, Get, Post } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Post('debug/throw')
  throwError(): never {
    // Manual trigger for exercising the error-reporting pipeline end-to-end.
    throw new Error('debug: manual test error');
  }
}
