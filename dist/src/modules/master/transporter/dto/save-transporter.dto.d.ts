export declare const TRANSPORT_MODES: readonly ["ROAD", "RAIL", "AIR", "SHIP"];
export type TransportMode = (typeof TRANSPORT_MODES)[number];
export declare class SaveTransporterDto {
    trnId?: string;
    companyId: string;
    code?: string | null;
    name: string;
    gstin?: string | null;
    isEnrolmentId?: boolean;
    mode?: TransportMode;
    phone?: string | null;
    email?: string | null;
    addr?: string | null;
    place?: string | null;
    pin?: string | null;
    stateCode?: string | null;
    remarks?: string | null;
    isActive?: boolean;
}
