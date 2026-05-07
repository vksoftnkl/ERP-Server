export enum TransactionStatus {
  DRAFT = 'DRAFT',
  COUNTING = 'COUNTING',
  COUNTED = 'COUNTED',
  APPROVED = 'APPROVED',
  POSTED = 'POSTED',
  CANCELLED = 'CANCELLED',
}


export enum StockTrackingType {
  NONE = 'NONE',
  BATCH = 'BATCH',
  MRP = 'MRP',
  SERIAL = 'SERIAL',
}