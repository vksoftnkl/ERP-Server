import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { DeleteLoyaltySchemeQueryDto } from "./delete-loyalty-scheme-query.dto";
import { LoyaltyGiftIdQueryDto } from "./loyalty-gift-id-query.dto";
import { SaveLoyaltySchemeDto } from "./save-loyalty-scheme.dto";

const SCHEME_ID = "01963d86-caf0-7b26-89f0-58ac380a2d5e";
const COMPANY_ID = "01963d86-caf0-7b26-89f0-58ac380a2d63";

describe("Promotion Loyalty Points DTOs", () => {
  it("rejects scheme end dates that are before the start date", async () => {
    const dto = plainToInstance(SaveLoyaltySchemeDto, {
      ls_name: "Summer Rewards",
      ls_type: "REDEEM",
      ls_start_date: "2026-04-30",
      ls_end_date: "2026-04-01",
      ls_comp_id: COMPANY_ID,
    });

    const errors = await validate(dto);

    expect(errors).not.toHaveLength(0);
    expect(errors[0].property).toBe("ls_end_date");
  });

  it("validates delete query UUID fields", async () => {
    const dto = plainToInstance(DeleteLoyaltySchemeQueryDto, {
      ls_id: SCHEME_ID,
      ls_updated_by: COMPANY_ID,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.ls_id).toBe(SCHEME_ID);
    expect(dto.ls_updated_by).toBe(COMPANY_ID);
  });

  it("validates required gift id query UUID strings", async () => {
    const dto = plainToInstance(LoyaltyGiftIdQueryDto, { lsg_id: SCHEME_ID });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.lsg_id).toBe(SCHEME_ID);
  });
});
