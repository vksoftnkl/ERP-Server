import { Body, Controller, Get, Post, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { assertMenuRight, type MenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { PurchaseInvoiceService } from './purchase-invoice.service';
import { CancelPurchaseInvoiceDto, GetPurchaseInvoiceQueryDto, GrnLinesQueryDto, SavePurchaseInvoiceDto } from './dto/save-purchase-invoice.dto';

/** Menu 24 — Purchase Entry. One right per route (code prefix PUR). plan-purchase-backend.md B6. */
export const PURCHASE_INVOICE_MENU_ID = 24;

@ApiTags('Purchase — Invoice')
@ApiBearerAuth()
@Controller('purchase/invoices')
export class PurchaseInvoiceController {
  constructor(
    private readonly service: PurchaseInvoiceService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Post('save')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Save a purchase invoice draft; header.post = true saves and posts in one transaction (stock in, books, bill-wise, shortage).' })
  async save(@Body() dto: SavePurchaseInvoiceDto) {
    await this.right(dto.header.piId ? 'edit' : 'create', 'save a purchase invoice');
    if (dto.header.post) await this.right('post', 'post a purchase invoice');
    const data = await this.service.save(dto);
    return { success: true, message: dto.header.post ? `Purchase ${data.header.piRefno} posted` : `Purchase ${data.header.piRefno} saved as draft`, data };
  }

  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'The server calculation of a bill (lines, charges, ITC, short, landed cost, net payable) — nothing is written.' })
  async validate(@Body() dto: SavePurchaseInvoiceDto) {
    await this.right('view', 'calculate a purchase invoice');
    return { success: true, message: 'Purchase invoice calculated', data: await this.service.preview(dto) };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Post a saved draft.' })
  async post(@Body() dto: GetPurchaseInvoiceQueryDto) {
    await this.right('post', 'post a purchase invoice');
    const data = await this.service.post(dto.piId, dto.accYear);
    return { success: true, message: `Purchase ${data.header.piRefno} posted`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'A purchase invoice: header, printed lines with their allocation rows, charges.' })
  async get(@Query() q: GetPurchaseInvoiceQueryDto) {
    await this.right('view', 'open a purchase invoice');
    return { success: true, message: 'Purchase invoice fetched', data: await this.service.get(q.piId, q.accYear) };
  }

  @Get('grn-lines')
  @Version(API_VERSION)
  @ApiOperation({ summary: "A supplier's posted GRN lines at the branch not yet billed (R4) — what a bill from GRN picks. `blocked` says why a line cannot be billed yet." })
  async grnLines(@Query() q: GrnLinesQueryDto) {
    await this.right('view', 'list GRN lines to bill');
    return { success: true, message: 'GRN lines to bill', data: await this.service.grnLines(q) };
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Cancel a posted bill nothing has paid or adjusted: stock out, voucher reversed, bill-wise and shortage rows withdrawn.' })
  async cancel(@Body() dto: CancelPurchaseInvoiceDto) {
    await this.right('cancel', 'cancel a purchase invoice');
    const data = await this.service.cancel(dto);
    return { success: true, message: `Purchase ${data.header.piRefno} cancelled`, data };
  }

  private async right(right: MenuRight, action: string) {
    await assertMenuRight(this.prisma, { userId: this.requestContext.getUserId(), menuId: PURCHASE_INVOICE_MENU_ID, right, codePrefix: 'PUR', action });
  }
}
