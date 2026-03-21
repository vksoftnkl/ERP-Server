export type AuditAction = 'insert' | 'update' | 'approve' | 'cancel';

export type AuditScreenKind = 'master' | 'transaction' | 'settings' | 'other';

export type CaptureScreenSnapshotInput = {
  screenId: number;
  keyNo: string | number | bigint;
  accYear?: string | null;
};

export type CreateAuditLogInput = {
  action: AuditAction | (string & {});
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
  action: AuditAction | (string & {});
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
