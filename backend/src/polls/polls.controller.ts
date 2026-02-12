import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { PollsService } from './polls.service';
import { CreatePollDto, SendPollDto } from './dto/polls.dto';

@Controller('polls')
@UseGuards(JwtAuthGuard)
export class PollsController {
  constructor(private pollsService: PollsService) {}

  @Post()
  async createPoll(@Request() req: any, @Body() dto: CreatePollDto) {
    return this.pollsService.createPoll(req.user.workspaceId, dto);
  }

  @Get()
  async listPolls(@Request() req: any) {
    return this.pollsService.listPolls(req.user.workspaceId);
  }

  @Get(':id')
  async getPoll(@Request() req: any, @Param('id') pollId: string) {
    return this.pollsService.getPoll(req.user.workspaceId, pollId);
  }

  @Post(':id/send')
  async sendPoll(
    @Request() req: any,
    @Param('id') pollId: string,
    @Body() dto: SendPollDto,
  ) {
    return this.pollsService.sendPoll(req.user.workspaceId, pollId, dto);
  }

  @Get(':id/interactions')
  async getInteractions(@Request() req: any, @Param('id') pollId: string) {
    return this.pollsService.getInteractions(req.user.workspaceId, pollId);
  }
}
