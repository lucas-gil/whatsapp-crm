import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post(':id/intro-file')
  @UseInterceptors(FileInterceptor('file'))
  async uploadIntroFile(
    @Request() req: any,
    @Param('id') pollId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    return this.pollsService.attachIntroFile(req.user.workspaceId, pollId, file);
  }

  @Post(':id/followup-file/:index')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFollowUpFile(
    @Request() req: any,
    @Param('id') pollId: string,
    @Param('index') index: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    return this.pollsService.attachFollowUpFile(
      req.user.workspaceId,
      pollId,
      index,
      file,
    );
  }

  @Post(':id/section-file/:index')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSectionFile(
    @Request() req: any,
    @Param('id') pollId: string,
    @Param('index') index: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const sectionIndex = Number.parseInt(index, 10);
    if (!Number.isFinite(sectionIndex)) {
      throw new BadRequestException('Indice de secao invalido');
    }

    return this.pollsService.attachSectionFile(
      req.user.workspaceId,
      pollId,
      sectionIndex,
      file,
    );
  }

  @Post(':id/section-option-file/:sectionIndex/:optionIndex')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSectionOptionFile(
    @Request() req: any,
    @Param('id') pollId: string,
    @Param('sectionIndex') sectionIndexParam: string,
    @Param('optionIndex') optionIndexParam: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Arquivo nao enviado');
    }

    const sectionIndex = Number.parseInt(sectionIndexParam, 10);
    const optionIndex = Number.parseInt(optionIndexParam, 10);
    if (!Number.isFinite(sectionIndex) || !Number.isFinite(optionIndex)) {
      throw new BadRequestException('Indice de opcao invalido');
    }

    return this.pollsService.attachSectionOptionFile(
      req.user.workspaceId,
      pollId,
      sectionIndex,
      optionIndex,
      file,
    );
  }

  @Get(':id/interactions')
  async getInteractions(@Request() req: any, @Param('id') pollId: string) {
    return this.pollsService.getInteractions(req.user.workspaceId, pollId);
  }
}
