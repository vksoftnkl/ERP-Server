export type AuditAction = 'insert' | 'update' | 'approve' | 'cancel';

// What a caller may hand to logEntityChange/createLog: the enum members the
// audit.audit_log_action column actually has, plus the legacy 'new' alias that
// normalizeAction() maps onto 'insert'. Capitalize<> covers the 'New' spelling
// the older masters use — normalizeAction() lowercases before it matches.
// Keep this narrow: a stray verb like 'create' has no enum member behind it and
// would only surface as a 400 at runtime, failing the write it was logging.
export type AuditActionInput = AuditAction | 'new' | Capitalize<AuditAction | 'new'>;

export type AuditScreenKind = 'master' | 'transaction' | 'settings' | 'other';

export type CaptureScreenSnapshotInput = {
  screenId: number;
  keyNo: string | number | bigint;
  accYear?: string | null;
};

export type CreateAuditLogInput = {
  action: AuditActionInput;
  screenId: number;
  tableName: string;
  pk?: string | number | bigint | null;
  displayName?: string | null;
  entityId?: string | null;
  originalRecord?: unknown;
  modifiedRecord?: unknown;
  changedFields?: unknown;
  userId?: string | number | null;
  branchId?: string | null;
  notes?: string | null;
};

export type LogEntityChangeInput = {
  action: AuditActionInput;
  tableName: string;
  screenId?: number;
  screenName?: string;
  screenType?: AuditScreenKind;
  pk?: string | number | bigint | null;
  displayName?: string | null;
  entityId?: string | null;
  originalRecord?: unknown;
  modifiedRecord?: unknown;
  accYear?: string | null;
  userId?: string | number | null;
  branchId?: string | null;
  notes?: string | null;
};
