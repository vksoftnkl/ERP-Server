import { CreateSequenceDto } from './create-sequence.dto';
declare const UpdateSequenceDto_base: import("@nestjs/common").Type<Partial<CreateSequenceDto>>;
export declare class UpdateSequenceDto extends UpdateSequenceDto_base {
    modifiedBy?: string | null;
}
export {};
