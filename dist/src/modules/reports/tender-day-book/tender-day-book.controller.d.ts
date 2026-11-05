import { NoTenderQueryDto, TenderDayBookQueryDto } from './tender-day-book.dto';
import { TenderDayBookService } from './tender-day-book.service';
import type { NoTenderPayload, TenderDayBookPayload } from './tender-day-book.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class TenderDayBookController {
    private readonly service;
    constructor(service: TenderDayBookService);
    dayBook(q: TenderDayBookQueryDto): Promise<Ok<TenderDayBookPayload>>;
    noTender(q: NoTenderQueryDto): Promise<Ok<NoTenderPayload>>;
}
export {};
