import { type MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
export type DataChangeEvent = {
    resource: string;
    method: string;
    at: number;
    originSessionId: string | null;
};
export declare class DataChangeService {
    private readonly changes;
    private readonly bootId;
    publish(event: DataChangeEvent): void;
    streamFor(sessionId: string | null): Observable<MessageEvent>;
}
