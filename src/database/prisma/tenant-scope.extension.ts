import { Prisma } from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
/**
 * Centralized company (tenant) scoping.
 *
 * Every request's company comes from the verified access token (AccessTokenGuard →
 * RequestContextService), never from client-supplied query params. When the
 * authenticated user is bound to a company, read queries on the models below are
 * automatically restricted to that company — services no longer have to remember
 * to add the filter, and a client asserting a foreign company_id gets no rows.
 *
 * Semantics:
 * - Users without a company on their token (SUPER ADMIN / legacy tokens issued
 *   before the company_id claim) are NOT scoped — current behavior is preserved.
 * - For models whose company column is nullable, rows with a NULL company are
 *   treated as global/shared and stay visible to every company.
 * - Scoped operations: findMany, findFirst(OrThrow), count, aggregate, groupBy,
 *   updateMany, deleteMany. Unique-key operations (findUnique, update, delete,
 *   upsert) address rows by primary key and cannot take extra filters; creates
 *   remain the owning service's responsibility.
 * - Interactive transactions (`$transaction(async (tx) => …)`) run on the base
 *   client and bypass this extension — transactional code must scope explicitly.
 */
type TenantModelConfig = {
  companyField: string;
  nullable: boolean;
};
export const TENANT_SCOPED_MODELS: Record<string, TenantModelConfig> = {
  AccountGroup: { companyField: 'accGroupCompanyId', nullable: true },
  AccLedgerMaster: { companyField: 'ledCompanyId', nullable: true },
  AccLedgerBankAccount: { companyField: 'lbaCompanyId', nullable: true },
  AccShipAddr: { companyField: 'saaCompanyId', nullable: true },
  AccVoucher: { companyField: 'avCompanyId', nullable: false },
  AccVoucherHeader: { companyField: 'avhCompanyId', nullable: false },
  AccVoucherBill: { companyField: 'avbdCompanyId', nullable: false },
  AccVoucherCheque: { companyField: 'chqCompanyId', nullable: false },
  AccVoucherDocDetail: { companyField: 'vtxCompanyId', nullable: false },
  AccVoucherDocEinvoice: { companyField: 'gdeCompanyId', nullable: false },
  AccVoucherDocEwaybill: { companyField: 'gdwCompanyId', nullable: false },
  AccVoucherDocRegister: { companyField: 'gdrCompanyId', nullable: false },
  BranchMaster: { companyField: 'brCompId', nullable: false },
  CustGroup: { companyField: 'cgrCompanyId', nullable: true },
  Customer: { companyField: 'cusCompanyId', nullable: true },
  EmpMaster: { companyField: 'empCompanyId', nullable: false },
  GspCompanyService: { companyField: 'csgCompanyId', nullable: false },
  ItemBatchMaster: { companyField: 'btmCompanyId', nullable: false },
  ItemBatchStock: { companyField: 'ibsCompanyId', nullable: false },
  ItemMaster: { companyField: 'itemCompanyId', nullable: false },
  ItemPriceMaster: { companyField: 'ipmCompanyId', nullable: true },
  ItemStockBalance: { companyField: 'isbCompanyId', nullable: false },
  ItemStockLedger: { companyField: 'stlCompanyId', nullable: false },
  LoyaltyScheme: { companyField: 'lsCompId', nullable: false },
  OpeningStockDetail: { companyField: 'oslCompanyId', nullable: false },
  OpeningStockHeader: { companyField: 'oshCompanyId', nullable: false },
  PhysicalStockBatchDetail: { companyField: 'psbCompanyId', nullable: false },
  PhysicalStockDetail: { companyField: 'psdCompanyId', nullable: false },
  PhysicalStockHeader: { companyField: 'psCompanyId', nullable: false },
  SaleQuotation: { companyField: 'sqCompanyId', nullable: false },
  SaleQuotationItem: { companyField: 'sqiCompanyId', nullable: false },
  Salesman: { companyField: 'smanCompanyId', nullable: true },
  Supplier: { companyField: 'supCompanyId', nullable: true },
  UserMaster: { companyField: 'usrCompanyId', nullable: true },
};
/** Client delegate property names (camelCase) for the scoped models. */
export const TENANT_SCOPED_DELEGATES: ReadonlySet<string> = new Set(
  Object.keys(TENANT_SCOPED_MODELS).map((model) => model.charAt(0).toLowerCase() + model.slice(1)),
);
const SCOPED_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);
export function createTenantScopeExtension(requestContext: RequestContextService) {
  return Prisma.defineExtension({
    name: 'tenant-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const config = TENANT_SCOPED_MODELS[model];
          if (!config || !SCOPED_OPERATIONS.has(operation)) {
            return query(args);
          }
          const companyId = requestContext.getCompanyId();
          if (!companyId) {
            return query(args);
          }
          const scopeFilter = config.nullable
            ? { OR: [{ [config.companyField]: companyId }, { [config.companyField]: null }] }
            : { [config.companyField]: companyId };
          const scopedArgs = { ...(args as Record<string, unknown> | undefined) } as {
            where?: Record<string, unknown>;
          };
          scopedArgs.where = scopedArgs.where ? { AND: [scopedArgs.where, scopeFilter] } : scopeFilter;
          return query(scopedArgs as typeof args);
        },
      },
    },
  });
}
