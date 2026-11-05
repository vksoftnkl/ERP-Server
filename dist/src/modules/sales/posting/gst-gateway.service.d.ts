export interface IrnCancelRequest {
    gdrId: string;
    accYear: string;
    companyId: string;
    reason: string;
}
export declare class GstGatewayService {
    private readonly logger;
    readonly configured = false;
    cancelIrn(req: IrnCancelRequest): Promise<{
        cancelledOn: string;
    }>;
    cancelEwb(req: IrnCancelRequest): Promise<{
        cancelledOn: string;
    }>;
    enqueueAfterPost(doc: {
        gdrId: string | null;
        einvoice: boolean;
        ewaybill: boolean;
    }): void;
}
