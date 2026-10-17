ALTER TABLE "sales"."loyalty_sch_list"
    ADD CONSTRAINT "fk_loyalty_sch_list_company"
        FOREIGN KEY ("ls_comp_id")
        REFERENCES "public"."companys" ("comp_id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE "sales"."loyalty_sch_list"
    ADD CONSTRAINT "fk_loyalty_sch_list_branch"
        FOREIGN KEY ("ls_branch_id")
        REFERENCES "public"."branch_master" ("br_id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE "sales"."loyalty_sch_points"
    ADD CONSTRAINT "fk_loyalty_sch_points_item"
        FOREIGN KEY ("lspt_item_id")
        REFERENCES "inventory"."item_master" ("item_id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE "sales"."loyalty_sch_points"
    ADD CONSTRAINT "fk_loyalty_sch_points_unit"
        FOREIGN KEY ("lspt_unit_id")
        REFERENCES "inventory"."item_unit_master" ("unit_id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE "sales"."loyalty_sch_gift"
    ADD CONSTRAINT "fk_loyalty_sch_gift_item"
        FOREIGN KEY ("lsg_item_id")
        REFERENCES "inventory"."item_master" ("item_id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;

ALTER TABLE "sales"."loyalty_sch_gift"
    ADD CONSTRAINT "fk_loyalty_sch_gift_unit"
        FOREIGN KEY ("lsg_unit_id")
        REFERENCES "inventory"."item_unit_master" ("unit_id")
        ON UPDATE CASCADE
        ON DELETE RESTRICT;
