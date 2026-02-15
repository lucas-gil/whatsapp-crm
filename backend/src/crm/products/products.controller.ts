import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt.guard';
import { ProductsService } from './products.service';

@Controller('crm/products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async listProducts(@Request() req: any) {
    return this.productsService.listProducts(req.user.workspaceId);
  }

  @Post()
  async createProduct(@Body() data: any, @Request() req: any) {
    return this.productsService.createProduct(req.user.workspaceId, data);
  }

  @Put(':id')
  async updateProduct(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any,
  ) {
    return this.productsService.updateProduct(req.user.workspaceId, id, data);
  }

  @Delete(':id')
  async deleteProduct(@Param('id') id: string, @Request() req: any) {
    return this.productsService.deleteProduct(req.user.workspaceId, id);
  }
}
