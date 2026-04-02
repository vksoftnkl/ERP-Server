import { Test, TestingModule } from '@nestjs/testing';
import { ListItemTaxQueryDto } from './dto/list-item-tax-query.dto';
import { SaveItemTaxDto } from './dto/save-item-tax.dto';
import { ItemsTaxMasterController } from './items-tax-master.controller';
import { ItemsTaxMasterService } from './items-tax-master.service';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const itemTaxPayload = {
  tax_id: TAX_ID,
  tax_name: 'GST 18%',
  tax_code: 'GST18',
  tax_taxability_type: 'TAXABLE',
  tax_is_reverse_charge: false,
  tax_cgst_perc: 9,
  tax_sgst_perc: 9,
  tax_igst_perc: 18,
  tax_cgst_pur_perc: 9,
  tax_sgst_pur_perc: 9,
  tax_igst_pur_perc: 18,
  tax_cess_type: 'NONE',
  tax_cess_perc: 0,
  tax_cess_unit: 0,
  tax_cess_pur_perc: 0,
  tax_cess_pur_unit: 0,
  tax_gst_rate_total: 18,
  tax_sales_ledger_id: null,
  tax_sales_return_ledger_id: null,
  tax_purchase_ledger_id: null,
  tax_purchase_return_ledger_id: null,
  tax_cgst_output_ledger_id: null,
  tax_sgst_output_ledger_id: null,
  tax_igst_output_ledger_id: null,
  tax_cess_output_ledger_id: null,
  tax_cgst_input_ledger_id: null,
  tax_sgst_input_ledger_id: null,
  tax_igst_input_ledger_id: null,
  tax_cess_input_ledger_id: null,
  tax_is_active: true,
  tax_is_deleted: false,
  tax_sync_date: null,
  tax_created_on: '2026-02-20T10:00:00.000Z',
  tax_created_by: 'tester',
  tax_modified_on: '2026-02-20T10:00:00.000Z',
  tax_modified_by: 'tester',
};
describe('ItemsTaxMasterController', () => {
  let controller: ItemsTaxMasterController;
  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsTaxMasterController],
      providers: [
        {
          provide: ItemsTaxMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsTaxMasterController>(ItemsTaxMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemTaxPayload);

    const payload: SaveItemTaxDto = {
      tax_name: 'GST 18%',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item tax created successfully',
      data: itemTaxPayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemTaxPayload);

    const payload: SaveItemTaxDto = {
      tax_id: TAX_ID,
      tax_name: 'GST 18%',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item tax updated successfully',
      data: itemTaxPayload,
    });
  });

  it('returns list wrapper with pagination meta', async () => {
    serviceMock.list.mockResolvedValue({
      items: [itemTaxPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListItemTaxQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item taxes fetched successfully',
      data: [itemTaxPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemTaxPayload);

    await expect(controller.getById(TAX_ID)).resolves.toEqual({
      success: true,
      message: 'Item tax fetched successfully',
      data: itemTaxPayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
      tax_id: TAX_ID,
      deleted: true,
    });

    await expect(controller.remove(TAX_ID)).resolves.toEqual({
      success: true,
      message: 'Item tax deleted successfully',
      data: {
        tax_id: TAX_ID,
        deleted: true,
      },
    });
  });
});
